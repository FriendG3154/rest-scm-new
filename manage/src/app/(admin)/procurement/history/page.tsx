"use client";

import { useMemo, useState } from "react";
import {
  Table,
  Card,
  Typography,
  Tag,
  DatePicker,
  Image,
  Space,
  Segmented,
  Collapse,
  Spin,
  Empty,
} from "antd";
import { api } from "~/trpc/react";
import { useRequireRestaurant } from "~/hook/use-restaurant-access";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

const { Title } = Typography;

type ViewMode = "supplier" | "restaurant" | "ingredient";

interface OrderItem {
  id: string;
  quantity: unknown;
  ingredient: {
    id: string;
    name: string;
    icon: string | null;
    unit: { name: string; min_value: unknown; max_value: unknown };
  };
  supplier: { id: string; company_name: string } | null;
}

interface OrderRecord {
  id: string;
  request_no: string;
  status: string;
  submitted_at: Date;
  restaurant: { id: string; name: string };
  items: OrderItem[];
}

/** 订单项引用 */
interface OrderItemRef {
  id: string;
  quantity: number;
}

/* ────────── 供应商视图 ────────── */
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

/* ────────── 餐厅视图 ────────── */
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

/* ────────── 食材视图 ────────── */
interface IngredientRestaurantDetail {
  restaurantName: string;
  quantity: number;
}
interface IngredientSupplierDetail {
  id: string;
  name: string;
  totalQty: number;
  restaurantDetails: IngredientRestaurantDetail[];
  multiRestaurant: boolean;
}
interface IngredientGroup {
  id: string;
  name: string;
  icon: string | null;
  unitName: string;
  totalQty: number;
  suppliers: IngredientSupplierDetail[];
}

/**
 * 历史供货单页面
 * 对标微信小程序汇总模块的已审核视图逻辑：
 * - 查询已审核订单，支持日期范围筛选
 * - 三种分组视图：按供应商、按餐厅、按食材
 * - 多餐厅/多供应商时可展开查看明细
 */
export default function ProcurementHistoryPage() {
  useRequireRestaurant();

  const yesterday = dayjs().subtract(1, "day");
  const [viewMode, setViewMode] = useState<ViewMode>("supplier");
  const [selectedDate, setSelectedDate] = useState<string | undefined>(yesterday.format("YYYY-MM-DD"));
  const [panelMonth, setPanelMonth] = useState<string>(yesterday.format("YYYY-MM"));

  const { data, isLoading } = api.order.listRequests.useQuery({
    status: "approved",
    date_from: selectedDate,
    date_to: selectedDate,
    page: 1,
    pageSize: 100,
  }, {
    enabled: !!selectedDate,
  });

  const { data: countData } = api.order.orderCountByDate.useQuery({
    month: panelMonth,
  });

  /** 每日订单数量映射 */
  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    if (countData) {
      for (const item of countData) {
        map.set(item.date, item.count);
      }
    }
    return map;
  }, [countData]);

  const allOrders = (data?.items ?? []) as unknown as OrderRecord[];
  const totalCount = data?.total ?? 0;

  const handleDateChange = (date: Dayjs | null) => {
    if (date) {
      setSelectedDate(date.format("YYYY-MM-DD"));
    } else {
      setSelectedDate(undefined);
    }
  };

  const handlePanelChange = (value: Dayjs) => {
    setPanelMonth(value.format("YYYY-MM"));
  };

  /** 自定义日期单元格，显示该日订单数量 */
  const cellRender = (current: string | number | Dayjs, info: { type: string; originNode: React.ReactElement }) => {
    if (info.type !== "date") return info.originNode;
    const d = dayjs(current);
    const dateStr = d.format("YYYY-MM-DD");
    const count = countMap.get(dateStr);
    return (
      <div className="flex flex-col items-center">
        <div>{d.date()}</div>
        {count ? (
          <div className="mt-0.5 text-xs leading-none text-blue-500">{count}单</div>
        ) : null}
      </div>
    );
  };

  /* ════════ 供应商视图分组 ════════ */
  const supplierGroups = useMemo<SupplierGroup[]>(() => {
    const map = new Map<string, { id: string; name: string; ingredientMap: Map<string, SupplierIngredientGroup & { restaurantMap: Map<string, SupplierRestaurantDetail> }> }>();
    for (const order of allOrders) {
      const restaurantId = order.restaurant?.id ?? "unknown";
      const restaurantName = order.restaurant?.name ?? "未知餐厅";
      for (const item of order.items) {
        const sid = item.supplier?.id ?? "unknown";
        if (!map.has(sid)) {
          map.set(sid, { id: sid, name: item.supplier?.company_name ?? "未指定供应商", ingredientMap: new Map() });
        }
        const supplier = map.get(sid)!;
        const iid = item.ingredient.id;
        if (!supplier.ingredientMap.has(iid)) {
          supplier.ingredientMap.set(iid, {
            id: iid, name: item.ingredient.name, icon: item.ingredient.icon, unitName: item.ingredient.unit.name,
            totalQty: 0, orderItems: [], restaurantDetails: [], multiRestaurant: false,
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
      id: g.id, name: g.name,
      items: Array.from(g.ingredientMap.values()).map((ing) => {
        const restaurantDetails = Array.from(ing.restaurantMap.values());
        return { id: ing.id, name: ing.name, icon: ing.icon, unitName: ing.unitName, totalQty: ing.totalQty, orderItems: ing.orderItems, restaurantDetails, multiRestaurant: restaurantDetails.length > 1 };
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
            id: iid, name: item.ingredient.name, icon: item.ingredient.icon, unitName: item.ingredient.unit.name,
            totalQty: 0, orderItems: [], supplierDetails: [], multiSupplier: false,
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
      id: g.id, name: g.name,
      items: Array.from(g.ingredientMap.values()).map((ing) => {
        const supplierDetails = Array.from(ing.supplierMap.values());
        return { id: ing.id, name: ing.name, icon: ing.icon, unitName: ing.unitName, totalQty: ing.totalQty, orderItems: ing.orderItems, supplierDetails, multiSupplier: supplierDetails.length > 1 };
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
            id: iid, name: item.ingredient.name, icon: item.ingredient.icon, unitName: item.ingredient.unit.name,
            totalQty: 0, suppliers: [], supplierMap: new Map(),
          });
        }
        const ing = map.get(iid)!;
        const qty = Number(item.quantity);
        ing.totalQty += qty;
        if (!ing.supplierMap.has(supplierId)) {
          ing.supplierMap.set(supplierId, {
            id: supplierId, name: supplierName, totalQty: 0,
            restaurantDetails: [], multiRestaurant: false, restaurantMap: new Map(),
          });
        }
        const sup = ing.supplierMap.get(supplierId)!;
        sup.totalQty += qty;
        if (!sup.restaurantMap.has(restaurantId)) {
          sup.restaurantMap.set(restaurantId, { restaurantName, quantity: 0 });
        }
        const rd = sup.restaurantMap.get(restaurantId)!;
        rd.quantity += qty;
      }
    }
    return Array.from(map.values()).map((g) => ({
      id: g.id, name: g.name, icon: g.icon, unitName: g.unitName, totalQty: g.totalQty,
      suppliers: Array.from(g.supplierMap.values()).map((s) => {
        const restaurantDetails = Array.from(s.restaurantMap.values());
        return { id: s.id, name: s.name, totalQty: s.totalQty, restaurantDetails, multiRestaurant: restaurantDetails.length > 1 };
      }),
    }));
  }, [allOrders]);

  const currentEmpty =
    (viewMode === "supplier" && supplierGroups.length === 0) ||
    (viewMode === "restaurant" && restaurantGroups.length === 0) ||
    (viewMode === "ingredient" && ingredientGroups.length === 0);

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Title level={4} className="!m-0">历史供货单</Title>
        <DatePicker
          defaultValue={yesterday}
          onChange={handleDateChange}
          onPanelChange={handlePanelChange}
          cellRender={cellRender}
          placeholder="选择日期查看供货单"
          style={{ width: 220 }}
        />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <Segmented
          value={viewMode}
          onChange={(val) => setViewMode(val as ViewMode)}
          options={[
            { label: "按供应商", value: "supplier" },
            { label: "按餐厅", value: "restaurant" },
            { label: "按食材", value: "ingredient" },
          ]}
        />
        <span className="text-gray-500">共 {totalCount} 单</span>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      )}

      {!isLoading && currentEmpty && <Empty description={selectedDate ? "该日期暂无数据" : "请选择日期查看供货单"} />}

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
                    render: (_, item: SupplierIngredientGroup) => `${item.totalQty} ${item.unitName}`,
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
                          render: (_, rd: SupplierRestaurantDetail) => `${rd.quantity} ${item.unitName}`,
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
                    render: (_, item: RestaurantIngredientGroup) => `${item.totalQty} ${item.unitName}`,
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
                          render: (_, sd: RestaurantSupplierDetail) => `${sd.quantity} ${item.unitName}`,
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
                    render: (_, s: IngredientSupplierDetail) => `${s.totalQty} ${group.unitName}`,
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
                          render: (_, rd: IngredientRestaurantDetail) => `${rd.quantity} ${group.unitName}`,
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
  );
}
