"use client";

import { Card, Col, Row, Statistic, Table, Tag, Typography } from "antd";
import {
  ShoppingCartOutlined,
  CheckCircleOutlined
} from "@ant-design/icons";
import { useTable } from "@refinedev/antd";
import { api } from "~/trpc/react";

const { Title } = Typography;

/**
 * 工作台/仪表盘页面
 * 展示统计数据和待处理单据
 */
export default function DashboardPage() {
  const { data: stats } = api.order.stats.useQuery();
  type PendingRequest = {
    id: string;
    request_no: string;
    submitted_at: string;
    restaurant: { name: string };
    items: Array<{ id: string }>;
  };

  const today = new Date().toISOString().slice(0, 10);

  const { tableProps } = useTable<PendingRequest>({
    resource: "orders",
    pagination: { pageSize: 10 },
    filters: {
      initial: [
        { field: "status", operator: "eq", value: "pending" },
        { field: "date_from", operator: "eq", value: today },
        { field: "date_to", operator: "eq", value: today },
      ],
      permanent: [
        { field: "status", operator: "eq", value: "pending" },
        { field: "date_from", operator: "eq", value: today },
        { field: "date_to", operator: "eq", value: today },
      ],
    },
    syncWithLocation: false,
  });

  return (
    <>
      <Title level={4}>工作台</Title>
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="今日待处理订单"
              value={stats?.pendingCount ?? 0}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: "#cf1322" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日已审核订单"
              value={stats?.approvedCount ?? 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#3f8600" }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="今日待处理单据">
        <Table
          {...(tableProps as React.ComponentProps<typeof Table<PendingRequest>>)}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: "ID",
              dataIndex: "request_no",
              key: "request_no",
              render: (v: string) => <Tag color="blue">{v}</Tag>,
            },
            {
              title: "餐厅实体",
              key: "restaurant",
              render: (_, record: PendingRequest) => record.restaurant.name,
            },
            {
              title: "食材种类",
              key: "item_count",
              render: (_, record: PendingRequest) => record.items.length,
            },
            {
              title: "提交日期",
              dataIndex: "submitted_at",
              key: "submitted_at",
              render: (v: string) =>
                new Date(v).toLocaleDateString("zh-CN"),
            },
          ]}
        />
      </Card>
    </>
  );
}
