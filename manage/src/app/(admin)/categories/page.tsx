"use client";

import { useState } from "react";
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  InputNumber,
  Space,
  Card,
  Popconfirm,
  Typography,
  Tag,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useDelete, useCan, type HttpError } from "@refinedev/core";
import { useModalForm, useTable } from "@refinedev/antd";

const { Title } = Typography;

interface CategoryFormValues {
  name: string;
  sort_order?: number;
}

interface ICategory {
  id: string;
  name: string;
  sort_order: number;
  _count: { ingredients: number };
}

/**
 * 食材大类管理页面
 * 提供食材分类的增删改查功能
 */
export default function CategoriesPage() {
  const [keyword, setKeyword] = useState("");

  const { tableProps, setFilters, tableQuery } = useTable<ICategory>({
    resource: "categories",
    pagination: { pageSize: 10 },
    filters: {
      initial: [{ field: "name", operator: "contains", value: "" }],
    },
    syncWithLocation: false,
  });

  const {
    modalProps: createModalProps,
    formProps: createFormProps,
    show: showCreateModal,
    formLoading: createFormLoading,
  } = useModalForm<ICategory, HttpError, CategoryFormValues>({
    resource: "categories",
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
  } = useModalForm<ICategory, HttpError, CategoryFormValues>({
    resource: "categories",
    action: "edit",
    syncWithLocation: false,
    autoResetForm: true,
    successNotification: () => ({ message: "更新成功", type: "success" }),
    onMutationSuccess: () => {
      void tableQuery.refetch();
    },
  });

  const { mutate: deleteOne } = useDelete<ICategory>();

  const { data: canCreate } = useCan({ resource: "categories", action: "create" });
  const { data: canEdit } = useCan({ resource: "categories", action: "edit" });
  const { data: canDelete } = useCan({ resource: "categories", action: "delete" });

  const handleSearch = (value: string) => {
    setFilters([{ field: "name", operator: "contains", value }]);
  };

  return (
    <>
      <Card>
        <div className="flex justify-between mb-4">
          <Title level={4} className="!m-0">食材大类</Title>
          <Space>
            <Input.Search
              placeholder="搜索分类名称"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={handleSearch}
              allowClear
              style={{ width: 250 }}
            />
            {canCreate?.can && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => showCreateModal()}>
                新增分类
              </Button>
            )}
          </Space>
        </div>
        <Table
          {...(tableProps as React.ComponentProps<typeof Table<ICategory>>)}
          rowKey="id"
          columns={[
            {
              title: "序号",
              key: "index",
              width: 70,
              render: (_, __, index) => {
                const pagination =
                  typeof tableProps.pagination === "object"
                    ? tableProps.pagination
                    : undefined;
                const current = pagination?.current ?? 1;
                const pageSize = pagination?.pageSize ?? 10;
                return (current - 1) * pageSize + index + 1;
              },
            },
            { title: "分类名称", dataIndex: "name", key: "name" },
            {
              title: "SKU 数量",
              key: "sku_count",
              render: (_, record: ICategory) => (
                <Tag color="blue">{record._count.ingredients}</Tag>
              ),
            },
            {
              title: "排序",
              dataIndex: "sort_order",
              key: "sort_order",
              width: 80,
            },
            {
              title: "操作",
              key: "action",
              width: 150,
              render: (_, record: ICategory) => (
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
                      title="确定删除该分类？"
                      description="删除后该分类下的食材将无法关联"
                      onConfirm={() =>
                        deleteOne(
                          { resource: "categories", id: record.id },
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
        title="新增分类"
        okText="保存"
        cancelText="取消"
        forceRender={false}
        confirmLoading={createFormLoading}
        destroyOnHidden
      >
        <Form {...createFormProps} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: "请输入分类名称" }]}
          >
            <Input placeholder="如：蔬菜类" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序序号" initialValue={0}>
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        {...(editModalProps as React.ComponentProps<typeof Modal>)}
        title="编辑分类"
        okText="保存"
        cancelText="取消"
         forceRender={false}
        confirmLoading={editFormLoading}
        destroyOnHidden
      >
        <Form {...editFormProps} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: "请输入分类名称" }]}
          >
            <Input placeholder="如：蔬菜类" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序序号" initialValue={0}>
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
