"use client";

import {
  Table,
  Input,
  Select,
  Space,
  Card,
  Typography,
  Tag,
  DatePicker,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useTable } from "@refinedev/antd";
import { api } from "~/trpc/react";
import dayjs from "dayjs";

const { Title } = Typography;
const { RangePicker } = DatePicker;

/** 模块中文映射 */
const MODULE_LABELS: Record<string, string> = {
  auth: "认证",
  category: "食材大类",
  ingredient: "食材",
  supplier: "供应商",
  restaurant: "餐厅",
  member: "人员",
  order: "订单",
  unit: "单位",
  auditLog: "审计日志",
};

/** 操作类型中文映射 */
const ACTION_LABELS: Record<string, string> = {
  login: "登录",
  logout: "登出",
  create: "创建",
  update: "更新",
  delete: "删除",
  approve: "审批",
  changePassword: "修改密码",
  resetPassword: "重置密码",
  mobileLogin: "小程序登录",
  wechatLogin: "微信登录",
  refreshToken: "刷新令牌",
  createRequest: "创建订单",
  updateItem: "更新订单项",
  deleteItem: "删除订单项",
};

interface AuditLogItem {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  module: string;
  target_id: string | null;
  detail: string | null;
  result: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

/**
 * 操作日志页面
 * 展示系统所有操作的审计日志记录，使用 Refine useTable 管理分页与筛选
 */
export default function AuditLogsPage() {
  const { tableProps, setFilters } = useTable<AuditLogItem>({
    resource: "audit-logs",
    pagination: { pageSize: 10 },
    filters: {
      initial: [
        { field: "keyword", operator: "contains", value: "" },
      ],
    },
    syncWithLocation: false,
  });

  const { data: options } = api.auditLog.options.useQuery();

  return (
    <Card>
      <Title level={4} className="!mb-4">
        操作日志
      </Title>

      <Space wrap className="mb-4">
        <Input.Search
          placeholder="用户名"
          prefix={<SearchOutlined />}
          onSearch={(value) => {
            setFilters([
              { field: "keyword", operator: "contains", value },
            ]);
          }}
          allowClear
          style={{ width: 160 }}
        />
        <Select
          placeholder="模块"
          onChange={(val) => {
            setFilters((prev) => {
              const next = prev.filter(
                (f) => !("field" in f && f.field === "module"),
              );
              if (val) next.push({ field: "module", operator: "eq", value: val });
              return next;
            });
          }}
          allowClear
          style={{ width: 140 }}
          options={(options?.modules ?? []).map((m) => ({
            label: MODULE_LABELS[m] ?? m,
            value: m,
          }))}
        />
        <Select
          placeholder="操作类型"
          onChange={(val) => {
            setFilters((prev) => {
              const next = prev.filter(
                (f) => !("field" in f && f.field === "action"),
              );
              if (val) next.push({ field: "action", operator: "eq", value: val });
              return next;
            });
          }}
          allowClear
          style={{ width: 140 }}
          options={(options?.actions ?? []).map((a) => ({
            label: ACTION_LABELS[a] ?? a,
            value: a,
          }))}
        />
        <Select
          placeholder="结果"
          onChange={(val) => {
            setFilters((prev) => {
              const next = prev.filter(
                (f) => !("field" in f && f.field === "result"),
              );
              if (val) next.push({ field: "result", operator: "eq", value: val });
              return next;
            });
          }}
          allowClear
          style={{ width: 120 }}
          options={[
            { label: "成功", value: "success" },
            { label: "失败", value: "fail" },
          ]}
        />
        <RangePicker
          onChange={(_, dateStrings) => {
            setFilters((prev) => {
              const next = prev.filter(
                (f) =>
                  !("field" in f &&
                    (f.field === "start_date" || f.field === "end_date")),
              );
              if (dateStrings[0] && dateStrings[1]) {
                next.push(
                  { field: "start_date", operator: "eq", value: dateStrings[0] },
                  { field: "end_date", operator: "eq", value: dateStrings[1] },
                );
              }
              return next;
            });
          }}
        />
      </Space>

      <Table<AuditLogItem>
        {...(tableProps as React.ComponentProps<typeof Table<AuditLogItem>>)}
        rowKey="id"
        columns={[
          {
            title: "时间",
            dataIndex: "created_at",
            key: "created_at",
            width: 180,
            render: (val: string) => dayjs(val).format("YYYY-MM-DD HH:mm:ss"),
          },
          {
            title: "用户",
            dataIndex: "user_name",
            key: "user_name",
            width: 100,
            render: (val: string | null) => val ?? "-",
          },
          {
            title: "模块",
            dataIndex: "module",
            key: "module",
            width: 100,
            render: (val: string) => MODULE_LABELS[val] ?? val,
          },
          {
            title: "操作",
            dataIndex: "action",
            key: "action",
            width: 120,
            render: (val: string) => ACTION_LABELS[val] ?? val,
          },
          {
            title: "结果",
            dataIndex: "result",
            key: "result",
            width: 80,
            render: (val: string) => (
              <Tag color={val === "success" ? "green" : "red"}>
                {val === "success" ? "成功" : "失败"}
              </Tag>
            ),
          },
          {
            title: "IP",
            dataIndex: "ip",
            key: "ip",
            width: 140,
            render: (val: string | null) => val ?? "-",
          },
          {
            title: "详情",
            dataIndex: "detail",
            key: "detail",
            ellipsis: true,
            render: (val: string | null) => {
              if (!val) return "-";
              try {
                const obj = JSON.parse(val) as Record<string, unknown>;
                return Object.entries(obj)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(", ");
              } catch {
                return val;
              }
            },
          },
        ]}
        scroll={{ x: 1000 }}
        size="middle"
      />
    </Card>
  );
}
