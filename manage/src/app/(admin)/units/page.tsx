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

interface UnitFormValues {
  name: string;
  min_value?: number | null;
  max_value?: number | null;
  description?: string | null;
}

interface IUnit {
  id: string;
  name: string;
  min_value: string | null;
  max_value: string | null;
  description: string | null;
  updated_at: string;
}

/**
 * 单位管理页面
 * 提供计量单位的增删改查功能
 */
export default function UnitsPage() {
  const [keyword, setKeyword] = useState("");
  const { tableProps, setFilters, tableQuery } = useTable<IUnit>({
    resource: "units",
    pagination: { pageSize: 20 },
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
  } = useModalForm<IUnit, HttpError, UnitFormValues>({
    resource: "units",
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
  } = useModalForm<IUnit, HttpError, UnitFormValues>({
    resource: "units",
    action: "edit",
    syncWithLocation: false,
    autoResetForm: true,
    successNotification: () => ({ message: "更新成功", type: "success" }),
    onMutationSuccess: () => {
      void tableQuery.refetch();
    },
  });

  const { mutate: deleteOne } = useDelete<IUnit>();

  const { data: canCreate } = useCan({ resource: "units", action: "create" });
  const { data: canEdit } = useCan({ resource: "units", action: "edit" });
  const { data: canDelete } = useCan({ resource: "units", action: "delete" });

  const handleSearch = (value: string) => {
    setFilters([{ field: "name", operator: "contains", value }]);
  };

  return (
    <>
      <Card>
        <div className="flex justify-between mb-4">
          <Title level={4} className="!m-0">单位管理</Title>
          <Space>
            <Input.Search
              placeholder="搜索单位名称"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={handleSearch}
              allowClear
              style={{ width: 250 }}
            />
            {canCreate?.can && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => showCreateModal()}>
                新增单位
              </Button>
            )}
          </Space>
        </div>
        <Table
          {...(tableProps as React.ComponentProps<typeof Table<IUnit>>)}
          rowKey="id"
          columns={[
            { title: "单位名称", dataIndex: "name", key: "name" },
            {
              title: "输入限制范围",
              key: "range",
              render: (_, record: IUnit) => {
                const min = record.min_value ? Number(record.min_value) : null;
                const max = record.max_value ? Number(record.max_value) : null;
                if (min !== null && max !== null) return `${min} - ${max}`;
                if (min !== null) return `≥ ${min}`;
                if (max !== null) return `≤ ${max}`;
                return "-";
              },
            },
            { title: "描述", dataIndex: "description", key: "description", render: (v: string | null) => v ?? "-" },
            {
              title: "更新时间",
              dataIndex: "updated_at",
              key: "updated_at",
              render: (v: string) => new Date(v).toLocaleString("zh-CN"),
            },
            {
              title: "操作",
              key: "action",
              width: 150,
              render: (_, record: IUnit) => (
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
                      title="确定删除该单位？"
                      onConfirm={() =>
                        deleteOne(
                          { resource: "units", id: record.id },
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
        title="新增单位"
        okText="保存"
         forceRender={false}
        cancelText="取消"
        confirmLoading={createFormLoading}
        destroyOnHidden
      >
        <Form {...createFormProps} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="单位名称"
            rules={[{ required: true, message: "请输入单位名称" }]}
          >
            <Input placeholder="如：千克(Kg)" />
          </Form.Item>
          <Space className="w-full">
            <Form.Item name="min_value" label="最小值">
              <InputNumber style={{ width: "100%" }} placeholder="可选" />
            </Form.Item>
            <Form.Item name="max_value" label="最大值">
              <InputNumber style={{ width: "100%" }} placeholder="可选" />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        {...(editModalProps as React.ComponentProps<typeof Modal>)}
        title="编辑单位"
        okText="保存"
         forceRender={false}
        cancelText="取消"
        confirmLoading={editFormLoading}
        destroyOnHidden
      >
        <Form {...editFormProps} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="单位名称"
            rules={[{ required: true, message: "请输入单位名称" }]}
          >
            <Input placeholder="如：千克(Kg)" />
          </Form.Item>
          <Space className="w-full">
            <Form.Item name="min_value" label="最小值">
              <InputNumber style={{ width: "100%" }} placeholder="可选" />
            </Form.Item>
            <Form.Item name="max_value" label="最大值">
              <InputNumber style={{ width: "100%" }} placeholder="可选" />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
