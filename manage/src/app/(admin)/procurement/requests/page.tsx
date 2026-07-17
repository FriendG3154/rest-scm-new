"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Table,
  Button,
  Select,
  Space,
  Card,
  Typography,
  Tag,
  InputNumber,
  Popconfirm,
  Modal,
  Form,
  Segmented,
  Collapse,
  Spin,
  Empty,
  message,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import { Image } from "antd";
import { useModalForm } from "@refinedev/antd";
import { useCan, type HttpError } from "@refinedev/core";
import { api } from "~/trpc/react";
import { useRequireRestaurant } from "~/hook/use-restaurant-access";

const { Title } = Typography;

type ViewMode = "supplier" | "restaurant" | "ingredient";

interface OrderItem {
  id: string;
  quantity: unknown; // Prisma Decimal
  ingredient: {
    id: string;
    name: string;
    icon: string | null;
    unit: { name: string; min_value: unknown; max_value: unknown };
  };
  supplier: { id: string; company_name: string; contact_name?: string } | null;
}

interface OrderRecord {
  id: string;
  request_no: string;
  status: string;
  submitted_at: Date;
  restaurant: { id: string; name: string };
  items: OrderItem[];
}

interface PurchaseCreateFormValues {
  restaurant_id: string;
  items: Array<{ ingredient_id: string; quantity: number }>;
}

type IngredientOption = {
  id: string;
  name: string;
  sku_code: string;
  unit: { name: string; min_value: string | null; max_value: string | null };
};

/** 订单项引用，用于聚合数量编辑时的按比例分配 */
interface OrderItemRef {
  id: string;
  quantity: number;
}

/* ────────── 供应商视图数据结构 ────────── */
interface SupplierRestaurantDetail {
  restaurantName: string;
  quantity: number;
  orderItems: OrderItemRef[];
}
interface SupplierIngredientGroup {
  id: string;
  name: string;
  icon: string | null;
  unitName: string;
  minValue: number | null;
  maxValue: number | null;
  totalQty: number;
  orderItems: OrderItemRef[];
  restaurantDetails: SupplierRestaurantDetail[];
  multiRestaurant: boolean;
}
interface SupplierGroup {
  id: string;
  name: string;
  items: SupplierIngredientGroup[];
}

/* ────────── 餐厅视图数据结构 ────────── */
interface RestaurantSupplierDetail {
  supplierName: string;
  quantity: number;
  orderItems: OrderItemRef[];
}
interface RestaurantIngredientGroup {
  id: string;
  name: string;
  icon: string | null;
  unitName: string;
  minValue: number | null;
  maxValue: number | null;
  totalQty: number;
  orderItems: OrderItemRef[];
  supplierDetails: RestaurantSupplierDetail[];
  multiSupplier: boolean;
}
interface RestaurantGroup {
  id: string;
  name: string;
  items: RestaurantIngredientGroup[];
}

/* ────────── 食材视图数据结构 ────────── */
interface IngredientRestaurantDetail {
  restaurantName: string;
  quantity: number;
  orderItems: OrderItemRef[];
}
interface IngredientSupplierDetail {
  id: string;
  name: string;
  totalQty: number;
  orderItems: OrderItemRef[];
  restaurantDetails: IngredientRestaurantDetail[];
  multiRestaurant: boolean;
}
interface IngredientGroup {
  id: string;
  name: string;
  icon: string | null;
  unitName: string;
  minValue: number | null;
  maxValue: number | null;
  totalQty: number;
  orderItems: OrderItemRef[];
  suppliers: IngredientSupplierDetail[];
}

/** 创建表单中的数量输入框，根据所选食材的单位范围动态设置 min/max */
function QuantityInput({
  value,
  onChange,
  ingredientItems,
  form,
  fieldName,
}: {
  value?: number;
  onChange?: (v: number | null) => void;
  ingredientItems: IngredientOption[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: ReturnType<typeof Form.useForm<any>>[0];
  fieldName: number;
}) {
  const selectedId = Form.useWatch(["items", fieldName, "ingredient_id"], form) as string | undefined;
  const ing = selectedId ? ingredientItems.find((i) => i.id === selectedId) : undefined;
  const minVal = ing?.unit?.min_value ? Number(ing.unit.min_value) : 0.01;
  const maxVal = ing?.unit?.max_value ? Number(ing.unit.max_value) : undefined;
  return <InputNumber value={value} onChange={onChange} placeholder="数量" min={minVal} max={maxVal} style={{ width: 120 }} />;
}

/**
 * 按比例分配聚合数量到多个订单项
 * @param orderItems - 原始订单项数组（含各自数量）
 * @param newTotal - 新的总数量
 * @returns 更新后的 { id, quantity }[] 数组
 */
function distributeQuantity(orderItems: OrderItemRef[], newTotal: number): OrderItemRef[] {
  const oldTotal = orderItems.reduce((sum, oi) => sum + oi.quantity, 0);
  if (oldTotal === newTotal) return orderItems;
  const updates: OrderItemRef[] = [];
  let remaining = newTotal;
  for (let i = 0; i < orderItems.length; i++) {
    const oi = orderItems[i]!;
    let newQty: number;
    if (i === orderItems.length - 1) {
      newQty = Math.max(0.01, remaining);
    } else {
      newQty = Math.max(0.01, Math.round((oi.quantity / oldTotal) * newTotal * 100) / 100);
      remaining -= newQty;
    }
    updates.push({ id: oi.id, quantity: newQty });
  }
  return updates;
}

/**
 * 采购需求清单页面
 * 对标微信小程序汇总模块逻辑：
 * - 使用 summaryToday 接口获取今日待审核/已审核数据
 * - 审核状态 tab 切换（未审核/已审核）
 * - 三种分组视图：按供应商、按餐厅、按食材
 * - 支持聚合数量编辑（按比例分配）
 * - 一键审核所有待处理订单
 */
export default function ProcurementRequestsPage() {
  useRequireRestaurant();

  const [statusTab, setStatusTab] = useState<0 | 1>(0);
  const [viewMode, setViewMode] = useState<ViewMode>("supplier");

  const { data: summaryData, isLoading, refetch } = api.order.summaryToday.useQuery();

  const { data: restaurants } = api.restaurant.all.useQuery();
  const { data: ingredients } = api.ingredient.list.useQuery({ page: 1, pageSize: 10 });
  const restaurantList = (restaurants ?? []) as Array<{ id: string; name: string }>;
  const ingredientItems = (ingredients?.items ?? []) as IngredientOption[];

  const pendingOrders = (summaryData?.pendingItems ?? []) as unknown as OrderRecord[];
  const approvedOrders = (summaryData?.approvedItems ?? []) as unknown as OrderRecord[];
  const hasPending = pendingOrders.length > 0;
  const hasApproved = approvedOrders.length > 0;
  const showStatusTab = hasPending && hasApproved;

  const currentStatus = statusTab === 0 ? "pending" : "approved";
  const allOrders: OrderRecord[] = statusTab === 0 ? pendingOrders : approvedOrders;
  const isPending = currentStatus === "pending";

  const {
    modalProps: createModalProps,
    formProps: createFormProps,
    show: showCreateModal,
    formLoading: createFormLoading,
  } = useModalForm<OrderRecord, HttpError, PurchaseCreateFormValues>({
    resource: "orders",
    action: "create",
    syncWithLocation: false,
    autoResetForm: true,
    successNotification: () => ({ message: "需求单创建成功", type: "success" }),
    onMutationSuccess: () => {
      void refetch();
    },
  });

  const updateItemMutation = api.order.updateItem.useMutation({
    onSuccess: () => void refetch(),
  });
  const deleteItemMutation = api.order.deleteItem.useMutation({
    onSuccess: () => void refetch(),
  });
  const approveMutation = api.order.approve.useMutation({
    onSuccess: () => void refetch(),
  });

  const { data: canCreate } = useCan({ resource: "orders", action: "create" });
  const { data: canUpdate } = useCan({ resource: "orders", action: "edit" });
  const { data: canDeleteItem } = useCan({ resource: "orders", action: "delete" });

  /**
   * 聚合数量编辑：修改后按比例分配到各订单项
   * @param orderItems - 所有关联订单项
   * @param newTotal - 新的聚合数量
   */
  const handleGroupQtyChange = useCallback(
    async (orderItems: OrderItemRef[], newTotal: number) => {
      const updates = distributeQuantity(orderItems, newTotal);
      for (const u of updates) {
        await updateItemMutation.mutateAsync({ id: u.id, quantity: u.quantity });
      }
    },
    [updateItemMutation],
  );

  /**
   * 删除聚合项关联的所有订单项
   * @param orderItems - 要删除的订单项数组
   */
  const handleDeleteGroupItems = useCallback(
    async (orderItems: OrderItemRef[]) => {
      for (const oi of orderItems) {
        await deleteItemMutation.mutateAsync({ id: oi.id });
      }
    },
    [deleteItemMutation],
  );

  /**
   * 一键审核所有 pending 订单
   */
  const handleApproveAll = useCallback(async () => {
    try {
      for (const order of pendingOrders) {
        await approveMutation.mutateAsync({ id: order.id });
      }
      void message.success("审核通过");
    } catch {
      void message.error("审核失败");
    }
  }, [pendingOrders, approveMutation]);

  /* ════════ 供应商视图分组 ════════ */
  const supplierGroups = useMemo<SupplierGroup[]>(() => {
    const map = new Map<string, { id: string; name: string; ingredientMap: Map<string, SupplierIngredientGroup & { restaurantMap: Map<string, SupplierRestaurantDetail> }> }>();
    for (const order of allOrders) {
      const restaurantId = order.restaurant?.id ?? "unknown";
      const restaurantName = order.restaurant?.name ?? "未知餐厅";
      for (const item of order.items) {
        const sid = item.supplier?.id ?? "unknown";
        if (!map.has(sid)) {
          map.set(sid, {
            id: sid,
            name: item.supplier?.company_name ?? "未指定供应商",
            ingredientMap: new Map(),
          });
        }
        const supplier = map.get(sid)!;
        const iid = item.ingredient.id;
        if (!supplier.ingredientMap.has(iid)) {
          supplier.ingredientMap.set(iid, {
            id: iid,
            name: item.ingredient.name,
            icon: item.ingredient.icon,
            unitName: item.ingredient.unit.name,
            minValue: item.ingredient.unit.min_value != null ? Number(item.ingredient.unit.min_value) : null,
            maxValue: item.ingredient.unit.max_value != null ? Number(item.ingredient.unit.max_value) : null,
            totalQty: 0,
            orderItems: [],
            restaurantDetails: [],
            multiRestaurant: false,
            restaurantMap: new Map(),
          });
        }
        const ing = supplier.ingredientMap.get(iid)!;
        const qty = Number(item.quantity);
        ing.totalQty += qty;
        ing.orderItems.push({ id: item.id, quantity: qty });
        if (!ing.restaurantMap.has(restaurantId)) {
          ing.restaurantMap.set(restaurantId, { restaurantName, quantity: 0, orderItems: [] });
        }
        const rd = ing.restaurantMap.get(restaurantId)!;
        rd.quantity += qty;
        rd.orderItems.push({ id: item.id, quantity: qty });
      }
    }
    return Array.from(map.values()).map((g) => ({
      id: g.id,
      name: g.name,
      items: Array.from(g.ingredientMap.values()).map((ing) => {
        const restaurantDetails = Array.from(ing.restaurantMap.values());
        return {
          id: ing.id,
          name: ing.name,
          icon: ing.icon,
          unitName: ing.unitName,
          minValue: ing.minValue,
          maxValue: ing.maxValue,
          totalQty: ing.totalQty,
          orderItems: ing.orderItems,
          restaurantDetails,
          multiRestaurant: restaurantDetails.length > 1,
        };
      }),
    }));
  }, [allOrders]);

  /* ════════ 餐厅视图分组 ════════ */
  const restaurantGroups = useMemo<RestaurantGroup[]>(() => {
    const map = new Map<string, { id: string; name: string; ingredientMap: Map<string, RestaurantIngredientGroup & { supplierMap: Map<string, RestaurantSupplierDetail> }> }>();
    for (const order of allOrders) {
      const rid = order.restaurant?.id ?? "unknown";
      if (!map.has(rid)) {
        map.set(rid, { id: rid, name: order.restaurant?.name ?? "", ingredientMap: new Map() });
      }
      const rest = map.get(rid)!;
      for (const item of order.items) {
        const iid = item.ingredient.id;
        const supplierId = item.supplier?.id ?? "unknown";
        const supplierName = item.supplier?.company_name ?? "未指定供应商";
        if (!rest.ingredientMap.has(iid)) {
          rest.ingredientMap.set(iid, {
            id: iid,
            name: item.ingredient.name,
            icon: item.ingredient.icon,
            unitName: item.ingredient.unit.name,
            minValue: item.ingredient.unit.min_value != null ? Number(item.ingredient.unit.min_value) : null,
            maxValue: item.ingredient.unit.max_value != null ? Number(item.ingredient.unit.max_value) : null,
            totalQty: 0,
            orderItems: [],
            supplierDetails: [],
            multiSupplier: false,
            supplierMap: new Map(),
          });
        }
        const ing = rest.ingredientMap.get(iid)!;
        const qty = Number(item.quantity);
        ing.totalQty += qty;
        ing.orderItems.push({ id: item.id, quantity: qty });
        if (!ing.supplierMap.has(supplierId)) {
          ing.supplierMap.set(supplierId, { supplierName, quantity: 0, orderItems: [] });
        }
        const sd = ing.supplierMap.get(supplierId)!;
        sd.quantity += qty;
        sd.orderItems.push({ id: item.id, quantity: qty });
      }
    }
    return Array.from(map.values()).map((g) => ({
      id: g.id,
      name: g.name,
      items: Array.from(g.ingredientMap.values()).map((ing) => {
        const supplierDetails = Array.from(ing.supplierMap.values());
        return {
          id: ing.id,
          name: ing.name,
          icon: ing.icon,
          unitName: ing.unitName,
          minValue: ing.minValue,
          maxValue: ing.maxValue,
          totalQty: ing.totalQty,
          orderItems: ing.orderItems,
          supplierDetails,
          multiSupplier: supplierDetails.length > 1,
        };
      }),
    }));
  }, [allOrders]);

  /* ════════ 食材视图分组（三层级：食材 → 供应商 → 餐厅） ════════ */
  const ingredientGroups = useMemo<IngredientGroup[]>(() => {
    const map = new Map<string, IngredientGroup & { supplierMap: Map<string, IngredientSupplierDetail & { restaurantMap: Map<string, IngredientRestaurantDetail> }> }>();
    for (const order of allOrders) {
      const restaurantId = order.restaurant?.id ?? "unknown";
      const restaurantName = order.restaurant?.name ?? "未知餐厅";
      for (const item of order.items) {
        const iid = item.ingredient.id;
        const supplierId = item.supplier?.id ?? "unknown";
        const supplierName = item.supplier?.company_name ?? "未指定供应商";
        if (!map.has(iid)) {
          map.set(iid, {
            id: iid,
            name: item.ingredient.name,
            icon: item.ingredient.icon,
            unitName: item.ingredient.unit.name,
            minValue: item.ingredient.unit.min_value != null ? Number(item.ingredient.unit.min_value) : null,
            maxValue: item.ingredient.unit.max_value != null ? Number(item.ingredient.unit.max_value) : null,
            totalQty: 0,
            orderItems: [],
            suppliers: [],
            supplierMap: new Map(),
          });
        }
        const ing = map.get(iid)!;
        const qty = Number(item.quantity);
        ing.totalQty += qty;
        ing.orderItems.push({ id: item.id, quantity: qty });
        if (!ing.supplierMap.has(supplierId)) {
          ing.supplierMap.set(supplierId, {
            id: supplierId,
            name: supplierName,
            totalQty: 0,
            orderItems: [],
            restaurantDetails: [],
            multiRestaurant: false,
            restaurantMap: new Map(),
          });
        }
        const sup = ing.supplierMap.get(supplierId)!;
        sup.totalQty += qty;
        sup.orderItems.push({ id: item.id, quantity: qty });
        if (!sup.restaurantMap.has(restaurantId)) {
          sup.restaurantMap.set(restaurantId, { restaurantName, quantity: 0, orderItems: [] });
        }
        const rd = sup.restaurantMap.get(restaurantId)!;
        rd.quantity += qty;
        rd.orderItems.push({ id: item.id, quantity: qty });
      }
    }
    return Array.from(map.values()).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      unitName: g.unitName,
      minValue: g.minValue,
      maxValue: g.maxValue,
      totalQty: g.totalQty,
      orderItems: g.orderItems,
      suppliers: Array.from(g.supplierMap.values()).map((s) => {
        const restaurantDetails = Array.from(s.restaurantMap.values());
        return {
          id: s.id,
          name: s.name,
          totalQty: s.totalQty,
          orderItems: s.orderItems,
          restaurantDetails,
          multiRestaurant: restaurantDetails.length > 1,
        };
      }),
    }));
  }, [allOrders]);

  const currentEmpty =
    (viewMode === "supplier" && supplierGroups.length === 0) ||
    (viewMode === "restaurant" && restaurantGroups.length === 0) ||
    (viewMode === "ingredient" && ingredientGroups.length === 0);

  /** 渲染可编辑数量或只读数量 */
  const renderQty = (
    qty: number,
    unitName: string,
    orderItems: OrderItemRef[],
    minValue: number | null,
    maxValue: number | null,
  ) => {
    if (isPending && canUpdate?.can) {
      return (
        <Space size={4}>
          <InputNumber
            value={qty}
            min={minValue ?? 0.01}
            max={maxValue ?? undefined}
            step={1}
            style={{ width: 90 }}
            onBlur={(e) => {
              const val = Number.parseFloat(e.target.value);
              if (val > 0 && val !== qty) {
                void handleGroupQtyChange(orderItems, val);
              }
            }}
          />
          <span>{unitName}</span>
        </Space>
      );
    }
    return <span>{qty} {unitName}</span>;
  };

  /** 渲染删除按钮 */
  const renderDeleteBtn = (orderItems: OrderItemRef[], itemName: string) => {
    if (!isPending || !canDeleteItem?.can) return null;
    return (
      <Popconfirm
        title={`确定删除「${itemName}」？共 ${orderItems.length} 条记录`}
        onConfirm={() => void handleDeleteGroupItems(orderItems)}
      >
        <Button type="link" danger size="small" icon={<DeleteOutlined />} />
      </Popconfirm>
    );
  };

  return (
    <>
      <Card>
        {/* 顶部标题栏 + 操作按钮 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Title level={4} className="!m-0">采购需求清单</Title>
          <Space wrap>
            {isPending && hasPending && canUpdate?.can && (
              <Popconfirm title="确认审核通过所有待处理订单？" onConfirm={() => void handleApproveAll()}>
                <Button type="primary" icon={<CheckOutlined />} loading={approveMutation.isPending}>
                  一键审核
                </Button>
              </Popconfirm>
            )}
            {/* {canCreate?.can && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => showCreateModal()}>
                新建需求单
              </Button>
            )} */}
          </Space>
        </div>

        {/* 审核状态 tab */}
        {(showStatusTab || (!hasPending && hasApproved) || (hasPending && !hasApproved)) && (
          <div className="mb-3">
            <Segmented
              value={statusTab}
              onChange={(val) => setStatusTab(val as 0 | 1)}
              options={[
                { label: `未审核${hasPending ? ` (${pendingOrders.length})` : ""}`, value: 0, disabled: !hasPending },
                { label: `已审核${hasApproved ? ` (${approvedOrders.length})` : ""}`, value: 1, disabled: !hasApproved },
              ]}
            />
          </div>
        )}

        {/* 分组方式切换 */}
        <div className="mb-4">
          <Segmented
            value={viewMode}
            onChange={(val) => setViewMode(val as ViewMode)}
            options={[
              { label: "按供应商", value: "supplier" },
              { label: "按餐厅", value: "restaurant" },
              { label: "按食材", value: "ingredient" },
            ]}
          />
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        )}

        {!isLoading && currentEmpty && <Empty description="暂无数据" />}

        {/* ═══════ 按供应商视图 ═══════ */}
        {!isLoading && viewMode === "supplier" && supplierGroups.length > 0 && (
          <Collapse
            defaultActiveKey={supplierGroups.map((g) => g.id)}
            items={supplierGroups.map((group) => ({
              key: group.id,
              label: (
                <span>
                  <Tag color="purple">{group.name}</Tag>
                  <span className="text-gray-500">共 {group.items.length} 种食材</span>
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  dataSource={group.items}
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: "食材", key: "name",
                      render: (_, item: SupplierIngredientGroup) => (
                        <Space>
                          {item.icon && <Image src={item.icon} alt="icon" width={28} height={28} preview={false} style={{ borderRadius: 4 }} />}
                          <span>{item.name}</span>
                        </Space>
                      ),
                    },
                    {
                      title: "数量",
                      key: "quantity",
                      render: (_, item: SupplierIngredientGroup) =>
                        (item.orderItems.length > 1 ? <span>{item.totalQty} {item.unitName}</span> : renderQty(item.totalQty, item.unitName, item.orderItems, item.minValue, item.maxValue))
                    },
                    {
                      title: "操作",
                      key: "action",
                      width: 60,
                      render: (_, item: SupplierIngredientGroup) => renderDeleteBtn(item.orderItems, item.name),
                    },
                  ]}
                  expandable={{
                    rowExpandable: (item: SupplierIngredientGroup) => item.multiRestaurant,
                    expandedRowRender: (item: SupplierIngredientGroup) => (
                      <Table
                        rowKey="restaurantName"
                        dataSource={item.restaurantDetails}
                        pagination={false}
                        size="small"
                        columns={[
                          { title: "餐厅", dataIndex: "restaurantName", key: "restaurantName" },
                          {
                            title: "数量",
                            key: "quantity",
                            render: (_, rd: SupplierRestaurantDetail) =>
                              renderQty(rd.quantity, item.unitName, rd.orderItems, item.minValue, item.maxValue),
                          },
                          {
                            title: "操作",
                            key: "action",
                            width: 60,
                            render: (_, rd: SupplierRestaurantDetail) =>
                              renderDeleteBtn(rd.orderItems, `${item.name}(${rd.restaurantName})`),
                          },
                        ]}
                      />
                    ),
                  }}
                />
              ),
            }))}
          />
        )}

        {/* ═══════ 按餐厅视图 ═══════ */}
        {!isLoading && viewMode === "restaurant" && restaurantGroups.length > 0 && (
          <Collapse
            defaultActiveKey={restaurantGroups.map((g) => g.id)}
            items={restaurantGroups.map((group) => ({
              key: group.id,
              label: (
                <span>
                  <Tag color="cyan">{group.name}</Tag>
                  <span className="text-gray-500">共 {group.items.length} 种食材</span>
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  dataSource={group.items}
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: "食材", key: "name",
                      render: (_, item: RestaurantIngredientGroup) => (
                        <Space>
                          {item.icon && <Image src={item.icon} alt="icon" width={28} height={28} preview={false} style={{ borderRadius: 4 }} />}
                          <span>{item.name}</span>
                        </Space>
                      ),
                    },
                    {
                      title: "数量",
                      key: "quantity",
                      render: (_, item: RestaurantIngredientGroup) =>
                                                (item.orderItems.length > 1 ? <span>{item.totalQty} {item.unitName}</span> : renderQty(item.totalQty, item.unitName, item.orderItems, item.minValue, item.maxValue))
                        // renderQty(item.totalQty, item.unitName, item.orderItems, item.minValue, item.maxValue),
                    },
                    {
                      title: "操作",
                      key: "action",
                      width: 60,
                      render: (_, item: RestaurantIngredientGroup) => renderDeleteBtn(item.orderItems, item.name),
                    },
                  ]}
                  expandable={{
                    rowExpandable: (item: RestaurantIngredientGroup) => item.multiSupplier,
                    expandedRowRender: (item: RestaurantIngredientGroup) => (
                      <Table
                        rowKey="supplierName"
                        dataSource={item.supplierDetails}
                        pagination={false}
                        size="small"
                        columns={[
                          { title: "供应商", dataIndex: "supplierName", key: "supplierName" },
                          {
                            title: "数量",
                            key: "quantity",
                            render: (_, sd: RestaurantSupplierDetail) =>
                              renderQty(sd.quantity, item.unitName, sd.orderItems, item.minValue, item.maxValue),
                          },
                          {
                            title: "操作",
                            key: "action",
                            width: 60,
                            render: (_, sd: RestaurantSupplierDetail) =>
                              renderDeleteBtn(sd.orderItems, `${item.name}(${sd.supplierName})`),
                          },
                        ]}
                      />
                    ),
                  }}
                />
              ),
            }))}
          />
        )}

        {/* ═══════ 按食材视图（三级：食材 → 供应商 → 餐厅） ═══════ */}
        {!isLoading && viewMode === "ingredient" && ingredientGroups.length > 0 && (
          <Collapse
            defaultActiveKey={ingredientGroups.map((g) => g.id)}
            items={ingredientGroups.map((group) => ({
              key: group.id,
              label: (
                <span>
                  {group.icon && <Image src={group.icon} alt="icon" width={24} height={24} preview={false} style={{ borderRadius: 4, verticalAlign: "middle", marginRight: 6 }} />}
                  <Tag color="green">{group.name}</Tag>
                  <span className="ml-2 font-semibold">合计: {group.totalQty} {group.unitName}</span>
                  <span className="ml-2 text-gray-500">({group.suppliers.length} 个供应商)</span>
                </span>
              ),
              children: (
                <Table
                  rowKey="id"
                  dataSource={group.suppliers}
                  pagination={false}
                  size="small"
                  columns={[
                    { title: "供应商", dataIndex: "name", key: "name" },
                    {
                      title: "数量",
                      key: "quantity",
                      render: (_, s: IngredientSupplierDetail) =>
                        (s.orderItems.length > 1 ? <span>{s.totalQty} {group.unitName}</span> : renderQty(s.totalQty, group.unitName, s.orderItems,  group.minValue, group.maxValue))
                        // renderQty(s.totalQty, group.unitName, s.orderItems, group.minValue, group.maxValue),
                    },
                    {
                      title: "操作",
                      key: "action",
                      width: 60,
                      render: (_, s: IngredientSupplierDetail) =>
                        renderDeleteBtn(s.orderItems, `${group.name}(${s.name})`),
                    },
                  ]}
                  expandable={{
                    rowExpandable: (s: IngredientSupplierDetail) => s.multiRestaurant,
                    expandedRowRender: (s: IngredientSupplierDetail) => (
                      <Table
                        rowKey="restaurantName"
                        dataSource={s.restaurantDetails}
                        pagination={false}
                        size="small"
                        columns={[
                          { title: "餐厅", dataIndex: "restaurantName", key: "restaurantName" },
                          {
                            title: "数量",
                            key: "quantity",
                            render: (_, rd: IngredientRestaurantDetail) =>
                              renderQty(rd.quantity, group.unitName, rd.orderItems, group.minValue, group.maxValue),
                          },
                          {
                            title: "操作",
                            key: "action",
                            width: 60,
                            render: (_, rd: IngredientRestaurantDetail) =>
                              renderDeleteBtn(rd.orderItems, `${group.name}(${rd.restaurantName})`),
                          },
                        ]}
                      />
                    ),
                  }}
                />
              ),
            }))}
          />
        )}
      </Card>

      {/* 新建需求单弹窗 */}
      <Modal
        {...(createModalProps as React.ComponentProps<typeof Modal>)}
        title="新建采购需求单"
        okText="保存"
        cancelText="取消"
        forceRender={false}
        confirmLoading={createFormLoading}
        destroyOnHidden
        width={600}
      >
        <Form {...createFormProps} layout="vertical" className="mt-4">
          <Form.Item
            name="restaurant_id"
            label="餐厅"
            rules={[{ required: true, message: "请选择餐厅" }]}
          >
            <Select
              placeholder="请选择餐厅"
              options={restaurantList.map((r) => ({ label: r.name, value: r.id }))}
            />
          </Form.Item>
          <Form.List name="items" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" className="mb-2 flex">
                    <Form.Item
                      {...restField}
                      name={[name, "ingredient_id"]}
                      rules={[{ required: true, message: "选择食材" }]}
                    >
                      <Select
                        placeholder="选择食材"
                        showSearch={{
                          filterOption: (input: string, option?: { label?: string }) =>
                            String(option?.label ?? "")
                              .toLowerCase()
                              .includes(input.toLowerCase()),
                        }}
                        style={{ width: 200 }}
                        options={ingredientItems.map((i) => ({
                          label: `${i.name} (${i.sku_code})`,
                          value: i.id,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, "quantity"]}
                      rules={[{ required: true, message: "输入数量" }]}
                      dependencies={[["items", name, "ingredient_id"]]}
                    >
                      <QuantityInput ingredientItems={ingredientItems} form={createFormProps.form!} fieldName={name} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                      />
                    )}
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加食材
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  );
}
