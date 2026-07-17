"use client";

import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Select,
  Space,
  Card,
  Popconfirm,
  Typography,
  Tag,
  Badge,
  Upload,
  Image,
  App,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd";
import { useDelete, useCan, type HttpError } from "@refinedev/core";
import { useModalForm, useTable } from "@refinedev/antd";
import { api } from "~/trpc/react";

const { Title } = Typography;

interface IngredientFormValues {
  sku_code: string;
  name: string;
  category_id: string;
  unit_id: string;
  icon?: string | null;
  description?: string | null;
  supplier_ids: string[];
  default_supplier_id?: string | null;
}

interface IIngredient {
  id: string;
  sku_code: string;
  name: string;
  category_id: string;
  unit_id: string;
  icon: string | null;
  description: string | null;
  category: { id: string; name: string };
  unit: { id: string; name: string };
  suppliers: Array<{ supplier_id: string; is_default: boolean; supplier: { id: string; company_name: string } }>;
}

interface IconUploadProps {
  value?: string | null;
  onChange?: (value: string | null) => void;
}

function IconUpload({ value, onChange }: IconUploadProps) {
  const { message } = App.useApp();

  const fileList: UploadFile[] = value
    ? [
        {
          uid: "icon-file",
          name: "icon.png",
          status: "done",
          url: value,
        },
      ]
    : [];

  const handleBeforeUpload: UploadProps["beforeUpload"] = async (file) => {
    if (!file.type.startsWith("image/")) {
      message.error("请上传图片文件");
      return Upload.LIST_IGNORE;
    }

    if (file.size > 300 * 1024) {
      message.error("图片过大，请控制在 300KB 以内");
      return Upload.LIST_IGNORE;
    }

    const formData = new FormData();
    formData.append("file", file as File);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        message.error(payload?.message ?? "上传失败，请重试");
        return Upload.LIST_IGNORE;
      }

      const payload = (await response.json()) as { url: string };
      onChange?.(payload.url);
    } catch {
      message.error("上传失败，请检查网络后重试");
      return Upload.LIST_IGNORE;
    }

    return Upload.LIST_IGNORE;
  };

  return (
    <Upload
      accept="image/*"
      listType="picture-card"
      maxCount={1}
      beforeUpload={handleBeforeUpload}
      fileList={fileList}
      onRemove={() => {
        onChange?.(null);
        return true;
      }}
      showUploadList={{ showPreviewIcon: true }}
    >
      {!value && (
        <div>
          <UploadOutlined />
          <div className="mt-2">上传图片</div>
        </div>
      )}
    </Upload>
  );
}

/**
 * 食材小类（SKU）管理页面
 * 基于 refine 的列表与弹窗表单实现增删改查
 */
export default function IngredientsPage() {
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();

  const { tableProps, setFilters, tableQuery } = useTable<IIngredient>({
    resource: "ingredients",
    pagination: { pageSize: 10 },
    filters: {
      initial: [
        { field: "name", operator: "contains", value: "" },
        { field: "category_id", operator: "eq", value: "" },
      ],
    },
    syncWithLocation: false,
  });

  const { data: categories } = api.category.all.useQuery();
  const { data: units } = api.unit.all.useQuery();
  const { data: suppliers } = api.supplier.all.useQuery();

  const categoryList = (categories ?? []) as Array<{ id: string; name: string }>;
  const unitList = (units ?? []) as Array<{ id: string; name: string }>;
  const supplierList = (suppliers ?? []) as Array<{
    id: string;
    company_name: string;
  }>;

  const {
    modalProps: createModalProps,
    formProps: createFormProps,
    show: showCreateModal,
    formLoading: createFormLoading,
  } = useModalForm<IIngredient, HttpError, IngredientFormValues>({
    resource: "ingredients",
    action: "create",
    syncWithLocation: false,
    autoResetForm: true,
    successNotification: () => ({ message: "创建成功", type: "success" }),
    onMutationSuccess: () => {
      void tableQuery.refetch();
    },
  });

  const {
    modalProps: editModalProps,
    formProps: editFormProps,
    show: showEditModal,
    formLoading: editFormLoading,
  } = useModalForm<IIngredient, HttpError, IngredientFormValues>({
    resource: "ingredients",
    action: "edit",
    syncWithLocation: false,
    autoResetForm: true,
    successNotification: () => ({ message: "更新成功", type: "success" }),
    onMutationSuccess: () => {
      void tableQuery.refetch();
    },
  });

  useEffect(() => {
    const editValues = editFormProps.initialValues as IIngredient | undefined;
    if (!editValues?.suppliers?.length) return;
    editFormProps.form?.setFieldValue(
      "supplier_ids",
      editValues.suppliers.map((item) => item.supplier_id),
    );
    const defaultSupplier = editValues.suppliers.find((item) => item.is_default);
    editFormProps.form?.setFieldValue(
      "default_supplier_id",
      defaultSupplier?.supplier_id ?? null,
    );
  }, [editFormProps.form, editFormProps.initialValues]);

  const { mutate: deleteOne } = useDelete<IIngredient>();

  const { data: canCreate } = useCan({ resource: "ingredients", action: "create" });
  const { data: canEdit } = useCan({ resource: "ingredients", action: "edit" });
  const { data: canDelete } = useCan({ resource: "ingredients", action: "delete" });

  const handleSearch = () => {
    setFilters([
      { field: "name", operator: "contains", value: keyword || undefined },
      { field: "category_id", operator: "eq", value: categoryFilter || undefined },
    ]);
  };

  return (
    <>
      <Card>
        <div className="mb-4 flex justify-between">
          <Title level={4} className="!m-0">食材小类</Title>
          <Space>
            <Select
              placeholder="筛选分类"
              allowClear
              style={{ width: 150 }}
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v)}
              options={categoryList.map((c) => ({ label: c.name, value: c.id }))}
            />
            <Input
              placeholder="搜索名称或编码"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
              style={{ width: 250 }}
            />
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
            {canCreate?.can && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => showCreateModal()}>
                新增食材
              </Button>
            )}
          </Space>
        </div>
        <Table
          {...(tableProps as React.ComponentProps<typeof Table<IIngredient>>)}
          rowKey="id"
          columns={[
            {
              title: "SKU 编码",
              dataIndex: "sku_code",
              key: "sku_code",
              render: (v: string) => <Badge color="blue" text={v} />,
            },
            { title: "食材名称", dataIndex: "name", key: "name" },
            {
              title: "图标",
              dataIndex: "icon",
              key: "icon",
              width: 100,
              render: (v: string | null) =>
                v ? <Image src={v} alt="icon" width={36} height={36} preview /> : "-",
            },
            {
              title: "所属分类",
              key: "category",
              render: (_, record: IIngredient) => <Tag>{record.category.name}</Tag>,
            },
            {
              title: "单位",
              key: "unit",
              render: (_, record: IIngredient) => record.unit.name,
            },
            {
              title: "供应商",
              key: "suppliers",
              render: (_, record: IIngredient) => {
                const defaultSup = record.suppliers.find((s) => s.is_default);
                return (
                  <Space size={4}>
                    <Tag color="green">{record.suppliers.length} 个</Tag>
                    {defaultSup && <Tag color="blue">默认: {defaultSup.supplier.company_name}</Tag>}
                  </Space>
                );
              },
            },
            {
              title: "说明",
              dataIndex: "description",
              key: "description",
              ellipsis: true,
              render: (v: string | null) => v ?? "-",
            },
            {
              title: "操作",
              key: "action",
              width: 150,
              render: (_, record: IIngredient) => (
                <Space>
                  {canEdit?.can && (
                    <Button
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => showEditModal(record.id)}
                    >
                      修改
                    </Button>
                  )}
                  {canDelete?.can && (
                    <Popconfirm
                      title="确定删除该食材？"
                      onConfirm={() =>
                        deleteOne(
                          { resource: "ingredients", id: record.id },
                          { onSuccess: () => void tableQuery.refetch() },
                        )
                      }
                    >
                      <Button type="link" danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        {...(createModalProps as React.ComponentProps<typeof Modal>)}
        title="新增食材"
        okText="保存"
        cancelText="取消"
        confirmLoading={createFormLoading}
        destroyOnHidden
         forceRender={false}
        width={600}
      >
        <Form {...createFormProps} layout="vertical" className="mt-4">
          <Form.Item
            name="sku_code"
            label="食材编码"
            rules={[{ required: true, message: "请输入SKU编码" }]}
          >
            <Input placeholder="如：SKU-VEG-001" />
          </Form.Item>
          <Form.Item
            name="name"
            label="食材名称"
            rules={[{ required: true, message: "请输入食材名称" }]}
          >
            <Input placeholder="如：土豆" />
          </Form.Item>
          <Form.Item
            name="category_id"
            label="所属分类"
            rules={[{ required: true, message: "请选择所属分类" }]}
          >
            <Select
              placeholder="请选择分类"
              options={categoryList.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          <Form.Item
            name="unit_id"
            label="计量单位"
            rules={[{ required: true, message: "请选择计量单位" }]}
          >
            <Select
              placeholder="请选择单位"
              options={unitList.map((u) => ({ label: u.name, value: u.id }))}
            />
          </Form.Item>
          <Form.Item name="icon" label="图标图片" valuePropName="value">
            <IconUpload />
          </Form.Item>
          <Form.Item name="supplier_ids" label="关联供应商" initialValue={[]}>
            <Select
              mode="multiple"
              placeholder="可选，选择供应商"
              options={supplierList.map((s) => ({ label: s.company_name, value: s.id }))}
            />
          </Form.Item>
          <Form.Item noStyle dependencies={["supplier_ids"]}>
            {({ getFieldValue }) => {
              const ids: string[] = getFieldValue("supplier_ids") ?? [];
              if (ids.length === 0) return null;
              return (
                <Form.Item name="default_supplier_id" label="默认供应商">
                  <Select
                    placeholder="请选择默认供应商"
                    allowClear
                    options={ids.map((id) => {
                      const s = supplierList.find((sup) => sup.id === id);
                      return { label: s?.company_name ?? id, value: id };
                    })}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        {...(editModalProps as React.ComponentProps<typeof Modal>)}
        title="编辑食材"
        okText="保存"
        cancelText="取消"
        confirmLoading={editFormLoading}
        destroyOnHidden
         forceRender={false}
        width={600}
      >
        <Form {...editFormProps} layout="vertical" className="mt-4">
          <Form.Item
            name="sku_code"
            label="食材编码"
            rules={[{ required: true, message: "请输入SKU编码" }]}
          >
            <Input placeholder="如：SKU-VEG-001" />
          </Form.Item>
          <Form.Item
            name="name"
            label="食材名称"
            rules={[{ required: true, message: "请输入食材名称" }]}
          >
            <Input placeholder="如：土豆" />
          </Form.Item>
          <Form.Item
            name="category_id"
            label="所属分类"
            rules={[{ required: true, message: "请选择所属分类" }]}
          >
            <Select
              placeholder="请选择分类"
              options={categoryList.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          <Form.Item
            name="unit_id"
            label="计量单位"
            rules={[{ required: true, message: "请选择计量单位" }]}
          >
            <Select
              placeholder="请选择单位"
              options={unitList.map((u) => ({ label: u.name, value: u.id }))}
            />
          </Form.Item>
          <Form.Item name="icon" label="图标图片" valuePropName="value">
            <IconUpload />
          </Form.Item>
          <Form.Item name="supplier_ids" label="关联供应商" initialValue={[]}>
            <Select
              mode="multiple"
              placeholder="可选，选择供应商"
              options={supplierList.map((s) => ({ label: s.company_name, value: s.id }))}
            />
          </Form.Item>
          <Form.Item noStyle dependencies={["supplier_ids"]}>
            {({ getFieldValue }) => {
              const ids: string[] = getFieldValue("supplier_ids") ?? [];
              if (ids.length === 0) return null;
              return (
                <Form.Item name="default_supplier_id" label="默认供应商">
                  <Select
                    placeholder="请选择默认供应商"
                    allowClear
                    options={ids.map((id) => {
                      const s = supplierList.find((sup) => sup.id === id);
                      return { label: s?.company_name ?? id, value: id };
                    })}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
