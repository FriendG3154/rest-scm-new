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
  Avatar,
  App,
  Spin,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import { useTable, useModalForm } from "@refinedev/antd";
import { useDelete, useCan, type HttpError } from "@refinedev/core";
import { api } from "~/trpc/react";

const { Title } = Typography;

const ROLE_TYPE_OPTIONS = [
  { label: "店长", value: "admin" },
  { label: "员工", value: "user" },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "blue",
  user: "green",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "店长",
  user: "员工",
};

interface MemberFormValues {
  name: string;
  phone: string;
  password?: string;
  role_type: string;
  restaurant_ids: string[];
}

interface IMember {
  id: string;
  name: string;
  password: string;
  role_type: string;
  phone: string;
  restaurants: {
    restaurant_id: string;
    restaurant: {
      id: string;
      name: string;
    };
  }[];
}

/**
 * 人员管理页面
 * 通过 refine 的 useTable / useModalForm / useDelete 完成增删改查
 */
export default function MembersPage() {
  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [restaurantFilter, setRestaurantFilter] = useState<string | undefined>();
  const [resetPwdModalOpen, setResetPwdModalOpen] = useState(false);
  const [resetPwdMemberId, setResetPwdMemberId] = useState<string>("");
  const [resetPwdForm] = Form.useForm();
  const { message } = App.useApp();

  const { tableProps, setFilters, tableQuery } = useTable<IMember>({
    resource: "members",
    pagination: { pageSize: 10 },
    filters: {
      initial: [
        { field: "name", operator: "contains", value: "" },
        { field: "role_type", operator: "eq", value: "" },
        { field: "restaurant_id", operator: "eq", value: "" },
      ],
    },
    syncWithLocation: false,
  });

  const { data: restaurants } = api.restaurant.all.useQuery();
  const restaurantList = (restaurants ?? []) as Array<{ id: string; name: string }>;

  const resetPasswordMutation = api.member.resetPassword.useMutation({
    onSuccess: () => {
      void message.success("密码已重置");
      setResetPwdModalOpen(false);
      resetPwdForm.resetFields();
    },
    onError: (err) => {
      void message.error(err.message);
    },
  });

  const {
    modalProps: createModalProps,
    formProps: createFormProps,
    show: showCreateModal,
    formLoading: createFormLoading,
  } = useModalForm<IMember, HttpError, MemberFormValues>({
    resource: "members",
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
  } = useModalForm<IMember, HttpError, MemberFormValues>({
    resource: "members",
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

  const { mutate: deleteOne } = useDelete<IMember>();

  const { data: canCreate } = useCan({ resource: "members", action: "create" });
  const { data: canEdit } = useCan({ resource: "members", action: "edit" });
  const { data: canDelete } = useCan({ resource: "members", action: "delete" });

  const handleSearch = () => {
    setFilters([
      { field: "name", operator: "contains", value: keyword || undefined },
      { field: "role_type", operator: "eq", value: roleFilter || undefined },
      { field: "restaurant_id", operator: "eq", value: restaurantFilter || undefined },
    ]);
  };

  useEffect(() => {
    const record = (tableProps.dataSource as IMember[] | undefined)?.find((r) => r.id === editFormProps.initialValues?.id);
    if (record) {
      editFormProps.form?.setFieldValue(
        "restaurant_ids",
        record.restaurants.map((r) => r.restaurant_id),
      );
    }
  }, [editFormProps])
  /** 管理员重置密码 */
  const handleResetPassword = (id: string) => {
    setResetPwdMemberId(id);
    setResetPwdModalOpen(true);
  };

  const handleResetPwdSubmit = () => {
    resetPwdForm.validateFields().then((values: { newPassword: string }) => {
      resetPasswordMutation.mutate({
        memberId: resetPwdMemberId,
        newPassword: values.newPassword,
      });
    }).catch(() => { /* validation failed */ });
  };

  /** 创建表单字段（含密码） */
  const CreateFormFields = () => (
    <>
      <Form.Item
        name="name"
        label="姓名"
        rules={[{ required: true, message: "请输入姓名" }]}
      >
        <Input placeholder="姓名" />
      </Form.Item>
      <Form.Item
        name="phone"
        label="联系电话"
        rules={[{ required: true, message: "请输入联系电话" }]}
      >
        <Input placeholder="手机号码" autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="password"
        label="密码"
        rules={[
          { required: true, message: "请输入密码" },
          { min: 6, message: "密码至少 6 位" },
        ]}
      >
        <Input.Password placeholder="请输入密码" autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="role_type"
        label="权限类型"
        initialValue="user"
        rules={[{ required: true, message: "请选择权限类型" }]}
      >
        <Select options={ROLE_TYPE_OPTIONS} />
      </Form.Item>
      <Form.Item name="restaurant_ids" label="管辖餐厅" initialValue={[]}>
        <Select
          mode="multiple"
          placeholder="可选，选择管辖餐厅"
          options={restaurantList.map((r) => ({ label: r.name, value: r.id }))}
        />
      </Form.Item>
    </>
  );

  /** 编辑表单字段（不含密码） */
  const EditFormFields = () => (
    <>
      <Form.Item
        name="name"
        label="姓名"
        rules={[{ required: true, message: "请输入姓名" }]}
      >
        <Input placeholder="姓名" />
      </Form.Item>
      <Form.Item
        name="phone"
        label="联系电话"
        rules={[{ required: true, message: "请输入联系电话" }]}
      >
        <Input placeholder="手机号码" autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="role_type"
        label="权限类型"
        initialValue="user"
        rules={[{ required: true, message: "请选择权限类型" }]}
      >
        <Select options={ROLE_TYPE_OPTIONS} />
      </Form.Item>
      <Form.Item name="restaurant_ids" label="管辖餐厅" initialValue={[]}>
        <Select
          mode="multiple"
          placeholder="可选，选择管辖餐厅"
          options={restaurantList.map((r) => ({ label: r.name, value: r.id }))}
        />
      </Form.Item>
    </>
  );

  return (
    <>
      <Card>
        <div className="flex justify-between mb-4">
          <Title level={4} className="!m-0">人员管理</Title>
          <Space>
            <Select
              placeholder="筛选角色"
              allowClear
              style={{ width: 120 }}
              value={roleFilter}
              onChange={(v) => setRoleFilter(v)}
              options={ROLE_TYPE_OPTIONS}
            />
            <Select
              placeholder="筛选餐厅"
              allowClear
              style={{ width: 150 }}
              value={restaurantFilter}
              onChange={(v) => setRestaurantFilter(v)}
              options={restaurantList.map((r) => ({ label: r.name, value: r.id }))}
            />
            <Input
              placeholder="搜索姓名或电话"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
              style={{ width: 220 }}
            />
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
            {canCreate?.can && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => showCreateModal()}>
                新增人员
              </Button>
            )}
          </Space>
        </div>
        <Table
          {...(tableProps as React.ComponentProps<typeof Table<IMember>>)}
          rowKey="id"
          columns={[
            {
              title: "姓名",
              key: "name",
              render: (_, record) => (
                <Space>
                  <Avatar size="small" icon={<UserOutlined />} />
                  <span>{record.name}</span>
                </Space>
              ),
            },
            {
              title: "角色",
              dataIndex: "role_type",
              key: "role_type",
              render: (role_type: string) => (
                <Tag color={ROLE_COLORS[role_type] ?? "default"}>
                  {ROLE_LABELS[role_type] ?? role_type}
                </Tag>
              ),
            },
            { title: "联系方式", dataIndex: "phone", key: "phone" },
            {
              title: "管辖餐厅",
              key: "restaurants",
              width: 300,
              render: (_, record) =>
                record.restaurants.length > 0
                  ? record.restaurants.map((r) => (
                    <Tag key={r.restaurant_id}>{r.restaurant.name}</Tag>
                  ))
                  : "-",
            },
            {
              title: "操作",
              key: "action",
              width: 200,
              render: (_, record) => (
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
                  {canEdit?.can && (
                    <Button
                      type="link"
                      icon={<KeyOutlined />}
                      onClick={() => handleResetPassword(record.id)}
                    >
                      重置密码
                    </Button>
                  )}
                  {canDelete?.can && (
                    <Popconfirm
                      title="确定删除该人员？"
                      onConfirm={() =>
                        deleteOne(
                          { resource: "members", id: record.id },
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
        title="新增人员"
        okText="保存"
        cancelText="取消"
        forceRender={false}
        destroyOnHidden
        confirmLoading={createFormLoading}
      >
        <Form {...createFormProps} layout="vertical" className="mt-4">
          <CreateFormFields />
        </Form>
      </Modal>

      <Modal
        {...(editModalProps as React.ComponentProps<typeof Modal>)}
        title="编辑人员"
        okText="保存"
        cancelText="取消"
        forceRender={false}
        destroyOnHidden
        confirmLoading={editFormLoading}
      >
        <Spin spinning={editFormLoading}>
          <Form {...editFormProps} layout="vertical" className="mt-4">
            <EditFormFields />
          </Form>
        </Spin>
      </Modal>

      <Modal
        open={resetPwdModalOpen}
        title="重置密码"
        okText="确认重置"
        cancelText="取消"
        confirmLoading={resetPasswordMutation.isPending}
        onOk={handleResetPwdSubmit}
        onCancel={() => {
          setResetPwdModalOpen(false);
          resetPwdForm.resetFields();
        }}
        destroyOnHidden
      >
        <Form form={resetPwdForm} layout="vertical" className="mt-4">
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 6, message: "密码至少 6 位" },
            ]}
          >
            <Input.Password placeholder="请输入新密码" autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "请确认新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次密码输入不一致"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
