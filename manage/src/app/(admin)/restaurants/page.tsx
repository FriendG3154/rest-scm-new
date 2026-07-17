"use client";

import {
  Table,
  Button,
  Input,
  Modal,
  Form,
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
import { useTable, useModalForm } from "@refinedev/antd";
import { useDelete, useCan, type HttpError } from "@refinedev/core";
import { useRequireRestaurant } from "~/hook/use-restaurant-access";

const { Title } = Typography;

interface RestaurantFormValues {
  name: string;
  contact_person: string;
  contact_phone: string;
  address: string;
}

/**
 * 餐厅管理页面
 * 通过 refine 的 useTable / useModalForm / useDelete 完成增删改查
 */

interface IRestaurant {
  id: string;
  name: string;
  contact_person: string;
  contact_phone: string;
  address: string;
}

export default function RestaurantsPage() {
  useRequireRestaurant();

  const { tableProps, setFilters, tableQuery } = useTable<IRestaurant>({
    resource: "restaurants",
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
  } = useModalForm<IRestaurant, HttpError, RestaurantFormValues>({
    resource: "restaurants",
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
    modalProps: editModalProps,
    formProps: editFormProps,
    show: showEditModal,
    formLoading: editFormLoading,
  } = useModalForm<IRestaurant, HttpError, RestaurantFormValues>({
    resource: "restaurants",
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

  const { mutate: deleteOne } = useDelete<IRestaurant>();

  const { data: canCreate } = useCan({ resource: "restaurants", action: "create" });
  const { data: canEdit } = useCan({ resource: "restaurants", action: "edit" });
  const { data: canDelete } = useCan({ resource: "restaurants", action: "delete" });

  const handleSearch = (value: string) => {
    setFilters([{ field: "name", operator: "contains", value }]);
  };

  return (
    <>
      <Card>
        <div className="flex justify-between mb-4">
          <Title level={4} className="!m-0">餐厅管理</Title>
          <Space>
            <Input.Search
              placeholder="搜索餐厅名称或负责人"
              prefix={<SearchOutlined />}
              onSearch={handleSearch}
              allowClear
              style={{ width: 280 }}
            />
            {canCreate?.can && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => showCreateModal()}>
                新增餐厅
              </Button>
            )}
          </Space>
        </div>
        <Table
          {...(tableProps as React.ComponentProps<typeof Table<IRestaurant>>)}
          rowKey="id"
          columns={[
            { title: "餐厅名称", dataIndex: "name", key: "name" },
            { title: "负责人", dataIndex: "contact_person", key: "contact_person" },
            { title: "联系电话", dataIndex: "contact_phone", key: "contact_phone" },
            {
              title: "详细地址",
              dataIndex: "address",
              key: "address",
              ellipsis: true,
            },
            {
              title: "操作",
              key: "action",
              render: (_, record: IRestaurant) => (
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
                      title="确定删除该餐厅？"
                      onConfirm={() =>
                        deleteOne(
                          { resource: "restaurants", id: record.id },
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
        title="新增餐厅"
        okText="保存"
         forceRender={false}
        cancelText="取消"
        confirmLoading={createFormLoading}
        destroyOnHidden
      >
        <Form {...createFormProps} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="门店名称"
            rules={[{ required: true, message: "请输入门店名称" }]}
          >
            <Input placeholder="如：XX餐厅（旗舰店）" />
          </Form.Item>
          <Form.Item
            name="contact_person"
            label="联系人"
            rules={[{ required: true, message: "请输入负责人" }]}
          >
            <Input placeholder="负责人" />
          </Form.Item>
          <Form.Item
            name="contact_phone"
            label="手机号码"
            rules={[{ required: true, message: "请输入联系电话" }]}
          >
            <Input placeholder="手机号码" />
          </Form.Item>
          <Form.Item
            name="address"
            label="详细地址"
            rules={[{ required: true, message: "请输入详细地址" }]}
          >
            <Input.TextArea rows={2} placeholder="详细地址" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        {...(editModalProps as React.ComponentProps<typeof Modal>)}
        title="编辑餐厅"
        okText="保存"
         forceRender={false}
        cancelText="取消"
        confirmLoading={editFormLoading}
        destroyOnHidden
      >
        <Form {...editFormProps} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="门店名称"
            rules={[{ required: true, message: "请输入门店名称" }]}
          >
            <Input placeholder="如：XX餐厅（旗舰店）" />
          </Form.Item>
          <Form.Item
            name="contact_person"
            label="联系人"
            rules={[{ required: true, message: "请输入负责人" }]}
          >
            <Input placeholder="负责人" />
          </Form.Item>
          <Form.Item
            name="contact_phone"
            label="手机号码"
            rules={[{ required: true, message: "请输入联系电话" }]}
          >
            <Input placeholder="手机号码" />
          </Form.Item>
          <Form.Item
            name="address"
            label="详细地址"
            rules={[{ required: true, message: "请输入详细地址" }]}
          >
            <Input.TextArea rows={2} placeholder="详细地址" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
