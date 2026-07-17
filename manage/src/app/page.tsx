"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Form, Input, Button, Checkbox, App, Typography, Card } from "antd";
import {
  UserOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/nextjs-router";
import { api } from "~/trpc/react";
import { encryptPassword } from "~/lib/crypto";
import { createTrpcDataProvider } from "~/lib/refine-data-provider";

const { Title, Text } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
  remember: boolean;
}

function LoginPageContent() {
  const { message } = App.useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const dataProvider = useMemo(() => createTrpcDataProvider(), []);

  const loginMutation = api.auth.login.useMutation({
    onSuccess: () => {
      message.success("登录成功");
      router.push("/dashboard");
    },
    onError: (err) => {
      message.error(err.message || "登录失败，请检查账号和密码");
    },
    onSettled: () => {
      setLoading(false);
    },
  });

  const handleLogin = (values: LoginFormValues) => {
    setLoading(true);
    loginMutation.mutate({
      username: values.username,
      password: encryptPassword(values.password),
    });
  };

  return (
    <Refine
      dataProvider={dataProvider}
      routerProvider={routerProvider}
      options={{ disableTelemetry: true }}
    >
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <Card className="w-full max-w-[420px] !rounded-xl !shadow-2xl !shadow-on-surface/5">
          <div className="px-2 pt-2 pb-6 text-center">
            {/* <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-xl mb-6 shadow-lg shadow-primary/20">
              <span className="text-white text-[28px] font-bold font-headline leading-none">
                CL
              </span>
            </div> */}
            <Title
              level={3}
              className="!m-0 !font-headline !font-extrabold !text-on-surface !tracking-tight"
            >
              XX主妇
            </Title>
            <Text className="text-on-surface-variant text-[13px] font-medium tracking-widest uppercase">
              供应管理系统
            </Text>
          </div>

          <div className="px-2 pb-2">
            <Form<LoginFormValues>
              onFinish={handleLogin}
              initialValues={{ remember: false }}
              layout="vertical"
              requiredMark={false}
              size="large"
            >
              <Form.Item
                name="username"
                label={
                  <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    账号
                  </span>
                }
                rules={[{ required: true, message: "请输入员工账号" }]}
              >
                <Input
                  autoComplete="username"
                  prefix={<UserOutlined className="text-outline text-base" />}
                  placeholder="请输入您的员工账号"
                  className="!bg-surface-container-low !border-transparent !border-b-2 !border-b-outline/20 !rounded-t-lg !h-12"
                />
              </Form.Item>

              <Form.Item
                label={
                  <div className="flex justify-between w-full">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                      密码
                    </span>
                  </div>
                }
                name="password"
                rules={[{ required: true, message: "请输入登录密码" }]}
              >
                <Input.Password
                  autoComplete="current-password"
                  prefix={<LockOutlined className="text-outline text-base" />}
                  placeholder="请输入登录密码"
                  iconRender={(visible) =>
                    visible ? (
                      <EyeOutlined className="text-outline" />
                    ) : (
                      <EyeInvisibleOutlined className="text-outline" />
                    )
                  }
                  className="!bg-surface-container-low !border-transparent !border-b-2 !border-b-outline/20 !rounded-t-lg !h-12"
                />
              </Form.Item>

              <Form.Item name="remember" valuePropName="checked">
                <Checkbox>
                  <span className="text-sm font-medium text-on-surface-variant">
                    记住登录状态
                  </span>
                </Checkbox>
              </Form.Item>

              <Form.Item className="!mt-4 !mb-0">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="!h-[52px] !rounded-xl !font-bold !text-base !font-headline !bg-primary !shadow-md !shadow-primary/20 !flex !items-center !justify-center !gap-2"
                >
                  立即登录
                  <ArrowRightOutlined />
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Card>
      </div>
    </Refine>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
