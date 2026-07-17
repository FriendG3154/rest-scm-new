import "antd/dist/reset.css";
import "~/styles/globals.css";

import { type Metadata } from "next";
import { ConfigProvider, App, type ThemeConfig } from "antd";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import zhCN from "antd/locale";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "XX餐厅",
  description: "XX餐厅",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const theme: ThemeConfig = {
  cssVar: { key: "rest-scm" },
  token: {
    colorPrimary: "#005db6",
    borderRadius: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ConfigProvider locale={zhCN} theme={theme}>
            <App>
              <TRPCReactProvider>
                {children}
              </TRPCReactProvider>
            </App>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
