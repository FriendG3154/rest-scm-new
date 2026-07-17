"use client";

import { useState } from "react";
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Space,
  Card,
  Popconfirm,
  App,
  Typography,
  Spin,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useTable, useModalForm } from "@refinedev/antd";
import { useDelete, useCan, type HttpError } from "@refinedev/core";

const { Title } = Typography;

interface SupplierFormValues {
  company_name: string;
  contact_name: string;
  contact_phone: string;
  license_number?: string | null;
}

interface ISupplier {
  id: string;
  company_name: string;
  contact_name: string;
  contact_phone: string;
  license_number: string | null;
}

/**
 * 供应商管理页面
 * 提供供应商的增删改查功能
 */
export default function SuppliersPage() {

  const { tableProps, setFilters, tableQuery } = useTable<ISupplier>({
    resource: "suppliers",
    pagination: { pageSize: 10 },
    filters: {
      initial: [
        {
          field: "keyword",
          operator: "contains",
          value: ""
        }
      ],
    },
    syncWithLocation: false,
  });

  const handleSearch = (value: string) => {
    setFilters([{ field: "name", operator: "contains", value }]);
  };

  const {
    modalProps: createModalProps,
    formProps: createFormProps,
    show: showCreateModal,
    formLoading: createFormLoading,
  } = useModalForm<ISupplier, HttpError, SupplierFormValues>({
    resource: "suppliers",
    action: "create",
    syncWithLocation: false,
    autoResetForm: true,
    successNotification: () => ({
      message: "创建成功",
      type: "success",
    }),
    onMutationSuccess: () => {
      void tableQuery.refetch();
    },
  });

  const {
    modalProps: modifyModalProps,
    formProps: modifyFormProps,
    show: showModifyModal,
    formLoading: modifyFormLoading,
  } = useModalForm<ISupplier, HttpError, SupplierFormValues>({
    resource: "suppliers",
    action: "edit",
    syncWithLocation: false,
    autoResetForm: true,
    successNotification: () => ({
      message: "更新成功",
      type: "success",
    }),
    onMutationSuccess: () => {
      void tableQuery.refetch();
    },
  });

  const { mutate: deleteOne } = useDelete<ISupplier, HttpError>();

  const { data: canCreate } = useCan({ resource: "suppliers", action: "create" });
  const { data: canEdit } = useCan({ resource: "suppliers", action: "edit" });
  const { data: canDelete } = useCan({ resource: "suppliers", action: "delete" });

  return (
    <>
      <Card>
        <div className="flex justify-between mb-4">
          <Title level={4} className="!m-0">供应商管理</Title>
          <Space>
            <Input.Search
              placeholder="搜索企业名称或联系人"
              prefix={<SearchOutlined />}
              onSearch={handleSearch}
              allowClear
              style={{ width: 280 }}
            />
            {canCreate?.can && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => showCreateModal()}>
                新增供应商
              </Button>
            )}
          </Space>
        </div>
        <Table
          rowKey="id"
          loading={tableQuery.isPending}
          {...(tableProps as React.ComponentProps<typeof Table<ISupplier>>)}
          columns={[
            { title: "供应商名称", dataIndex: "company_name", key: "company_name" },
            { title: "联系人", dataIndex: "contact_name", key: "contact_name" },
            { title: "联系电话", dataIndex: "contact_phone", key: "contact_phone" },
            {
              title: "营业执照号码",
              dataIndex: "license_number",
              key: "license_number",
              render: (v: string | null) => v ?? "-",
            },
            {
              title: "操作",
              key: "action",
              width: 150,
              render: (_, record) => (
                <Space>
                  {canEdit?.can && (
                    <Button
                      type="link"
                      icon={<EditOutlined />}
                      onClick={() => showModifyModal(record.id)}
                    >
                      修改
                    </Button>
                  )}
                  {canDelete?.can && (
                    <Popconfirm
                      title="确定删除该供应商？"
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => deleteOne(
                        { resource: "suppliers", id: record.id },
                        { onSuccess: () => void tableQuery.refetch() },
                      )}
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
        title="新增供应商"
        okText="创建"
        cancelText="取消"
        forceRender={false}
        confirmLoading={createFormLoading}
        destroyOnHidden
      >
        <Form  {...createFormProps} layout="vertical" className="mt-4">
          <Form.Item
            name="company_name"
            label="企业名称"
            rules={[{ required: true, message: "请输入企业名称" }]}
          >
            <Input placeholder="如：XX食品有限公司" />
          </Form.Item>
          <Form.Item
            name="contact_name"
            label="联系人姓名"
            rules={[{ required: true, message: "请输入联系人姓名" }]}
          >
            <Input placeholder="联系人" />
          </Form.Item>
          <Form.Item
            name="contact_phone"
            label="联系人电话"
            rules={[{ required: true, message: "请输入联系电话" }]}
          >
            <Input placeholder="手机号码" />
          </Form.Item>
          <Form.Item name="license_number" label="营业执照号码">
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>


      <Modal
        {...(modifyModalProps as React.ComponentProps<typeof Modal>)}
        title="编辑供应商"
        okText="保存"
        cancelText="取消"
        forceRender={false}
        confirmLoading={modifyFormLoading}
        destroyOnHidden
      >
        <Spin spinning={modifyFormLoading}>
          <Form  {...modifyFormProps} layout="vertical" className="mt-4">
            <Form.Item
              name="company_name"
              label="企业名称"
              rules={[{ required: true, message: "请输入企业名称" }]}
            >
              <Input placeholder="如：XX食品有限公司" />
            </Form.Item>
            <Form.Item
              name="contact_name"
              label="联系人姓名"
              rules={[{ required: true, message: "请输入联系人姓名" }]}
            >
              <Input placeholder="联系人" />
            </Form.Item>
            <Form.Item
              name="contact_phone"
              label="联系人电话"
              rules={[{ required: true, message: "请输入联系电话" }]}
            >
              <Input placeholder="手机号码" />
            </Form.Item>
            <Form.Item name="license_number" label="营业执照号码">
              <Input placeholder="可选" />
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
    </>
  );
}
