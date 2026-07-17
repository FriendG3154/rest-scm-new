"use client";

import { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Avatar, Typography, Dropdown, App, Modal, Form, Input, Spin } from "antd";
import {
  DashboardOutlined,
  ShopOutlined,
  TeamOutlined,
  AppstoreOutlined,
  TagsOutlined,
  TruckOutlined,
  ShoppingCartOutlined,
  UnorderedListOutlined,
  HistoryOutlined,
  ControlOutlined,
  LogoutOutlined,
  KeyOutlined,
  AuditOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { api } from "~/trpc/react";
import { createTrpcDataProvider } from "~/lib/refine-data-provider";
import { createAccessControlProvider } from "~/lib/access-control";
import { encryptPassword } from "~/lib/crypto";

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

type MenuItem = Required<MenuProps>["items"][number];

const menuItems: MenuItem[] = [
  {
    key: "/dashboard",
    icon: <DashboardOutlined />,
    label: <Link href="/dashboard">工作台</Link>,
  },
  {
    key: "org",
    icon: <ShopOutlined />,
    label: "组织机构",
    children: [
      {
        key: "/restaurants",
        icon: <ShopOutlined />,
        label: <Link href="/restaurants">餐厅管理</Link>,
      },
      {
        key: "/members",
        icon: <TeamOutlined />,
        label: <Link href="/members">人员管理</Link>,
      },
      {
        key: "/suppliers",
        icon: <TruckOutlined />,
        label: <Link href="/suppliers">供应商管理</Link>,
      },
    ],
  },
  {
    key: "ingredient",
    icon: <AppstoreOutlined />,
    label: "食材库",
    children: [
      {
        key: "/categories",
        icon: <TagsOutlined />,
        label: <Link href="/categories">食材大类</Link>,
      },
      {
        key: "/ingredients",
        icon: <AppstoreOutlined />,
        label: <Link href="/ingredients">食材小类</Link>,
      },
      {
        key: "/units",
        icon: <ControlOutlined />,
        label: <Link href="/units">单位管理</Link>,
      },
    ],
  },

  {
    key: "procurement",
    icon: <ShoppingCartOutlined />,
    label: "采购管理",
    children: [
      {
        key: "/procurement/requests",
        icon: <UnorderedListOutlined />,
        label: <Link href="/procurement/requests">需求清单</Link>,
      },
      {
        key: "/procurement/history",
        icon: <HistoryOutlined />,
        label: <Link href="/procurement/history">历史供货单</Link>,
      },
    ],
  },
  {
    key: "/audit-logs",
    icon: <AuditOutlined />,
    label: <Link href="/audit-logs">操作日志</Link>,
  },
];

/**
 * 管理后台布局
 * 包含侧边栏导航和顶部栏
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { message } = App.useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [changePwdModalOpen, setChangePwdModalOpen] = useState(false);
  const [changePwdForm] = Form.useForm();

  const dataProvider = useMemo(() => createTrpcDataProvider(), []);

  const { data: currentUser, isLoading: isUserLoading } = api.auth.me.useQuery();
  const userPermissions = useMemo(
    () => (currentUser?.profile as string[] | undefined) ?? [],
    [currentUser],
  );
  const accessControlProvider = useMemo(
    () => createAccessControlProvider(userPermissions, isUserLoading),
    [userPermissions, isUserLoading],
  );

  const logoutMutation = api.auth.logout.useMutation({
    onSuccess: () => {
      message.success("已退出登录");
      router.push("/");
    },
  });

  const changePasswordMutation = api.auth.changePassword.useMutation({
    onSuccess: () => {
      message.success("密码修改成功，请重新登录");
      setChangePwdModalOpen(false);
      changePwdForm.resetFields();
      router.push("/");
    },
    onError: (err) => {
      message.error(err.message);
    },
  });

  const handleChangePasswordSubmit = () => {
    changePwdForm
      .validateFields()
      .then((values: { oldPassword: string; newPassword: string }) => {
        changePasswordMutation.mutate({
          oldPassword: encryptPassword(values.oldPassword),
          newPassword: values.newPassword,
        });
      })
      .catch(() => { /* validation failed */ });
  };

  const avatarMenuItems: MenuProps["items"] = [
    {
      key: "changePassword",
      icon: <KeyOutlined />,
      label: "修改密码",
      onClick: () => setChangePwdModalOpen(true),
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      onClick: () => logoutMutation.mutate(),
    },
  ];

  // 计算当前展开的菜单组
  const openKeys = menuItems
    .filter(
      (item) =>
        item &&
        "children" in item &&
        item.children?.some(
          (child) => child && "key" in child && pathname.startsWith(child.key as string),
        ),
    )
    .map((item) => item!.key as string);

  return (
    <Suspense fallback={<Spin className="mt-20 flex justify-center" size="large" />}>
      <Refine
      dataProvider={dataProvider}
      routerProvider={routerProvider}
      accessControlProvider={accessControlProvider}
      resources={[
        { name: "restaurants", list: "/restaurants" },
        { name: "suppliers", list: "/suppliers" },
        { name: "categories", list: "/categories" },
        { name: "ingredients", list: "/ingredients" },
        { name: "units", list: "/units" },
        { name: "members", list: "/members" },
        { name: "orders", list: "/procurement/requests" },
      ]}
      options={{ disableTelemetry: true }}
    >
      <Layout style={{ minHeight: "100vh" }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={240}
          className="!bg-white border-r border-border"
        >
          <div className="h-16 flex items-center justify-center px-4 border-b border-border">
            {collapsed ? (
              <img src="/favicon.ico" alt="Logo" className="w-8 h-8" />
            ) : (
              <Text
                strong
                className="text-lg text-primary whitespace-nowrap font-headline"
              >
                XX餐厅
              </Text>
            )}
          </div>
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            defaultOpenKeys={openKeys}
            items={menuItems}
            className="!border-none mt-1"
          />
        </Sider>
        <Layout>
          <Header className="!bg-white border-b border-border !px-6 flex items-center justify-end h-16">
            <Dropdown menu={{ items: avatarMenuItems }} placement="bottomRight">
              <Avatar className="bg-primary cursor-pointer">
                管
              </Avatar>
            </Dropdown>
          </Header>
          <Content className="m-6">{isUserLoading ? <Spin className="mt-20 flex justify-center" size="large" /> : children}</Content>
        </Layout>
      </Layout>

      <Modal
        open={changePwdModalOpen}
        title="修改密码"
        okText="确认修改"
        cancelText="取消"
        confirmLoading={changePasswordMutation.isPending}
        onOk={handleChangePasswordSubmit}
        onCancel={() => {
          setChangePwdModalOpen(false);
          changePwdForm.resetFields();
        }}
        destroyOnHidden
      >
        <Form form={changePwdForm} layout="vertical" className="mt-4">
          <Form.Item
            name="oldPassword"
            label="旧密码"
            rules={[{ required: true, message: "请输入旧密码" }]}
          >
            <Input.Password placeholder="请输入旧密码" autoComplete="off" />
          </Form.Item>
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
      </Refine>
    </Suspense>
  );
}
