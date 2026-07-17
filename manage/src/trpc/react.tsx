"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server";
import { useState } from "react";
import SuperJSON from "superjson";

import { type AppRouter } from "~/server/api/root";
import { createQueryClient } from "./query-client";

/**
 * 餐厅权限相关的错误消息，匹配后端 assertRestaurantAccess 和 restaurantMemberMiddleware 的错误
 */
const RESTAURANT_AUTH_MESSAGES = ["您不属于该餐厅", "您未关联任何餐厅"];

/**
 * 全局 tRPC 错误处理
 * 当检测到餐厅权限不足时，提示用户并跳转首页
 */
function handleGlobalTRPCError(error: unknown) {
  if (typeof window === "undefined") return;

  const err = error as { data?: { code?: string }; message?: string };
  const isRestaurantAuthError =
    err.data?.code === "UNAUTHORIZED" &&
    typeof err.message === "string" &&
    RESTAURANT_AUTH_MESSAGES.some((msg) => err.message!.includes(msg));

  if (isRestaurantAuthError) {
    // 避免重复跳转
    if (!window.location.pathname.startsWith("/dashboard")) {
      window.location.href = "/dashboard";
    }
  }
}

let clientQueryClientSingleton: QueryClient | undefined = undefined;
const getQueryClient = () => {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return createQueryClient();
  }
  // Browser: use singleton pattern to keep the same query client
  if (!clientQueryClientSingleton) {
    clientQueryClientSingleton = createQueryClient();
    // 注入全局错误处理：捕获餐厅权限不足的 UNAUTHORIZED 错误并跳转首页
    clientQueryClientSingleton.getQueryCache().config.onError = (error) => {
      handleGlobalTRPCError(error);
    };
    clientQueryClientSingleton.getMutationCache().config.onError = (error) => {
      handleGlobalTRPCError(error);
    };
  }

  return clientQueryClientSingleton;
};

export const api = createTRPCReact<AppRouter>();

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: (op) =>
            process.env.NODE_ENV === "development" ||
            (op.direction === "down" && op.result instanceof Error),
        }),
        httpBatchLink({
          transformer: SuperJSON,
          url: getBaseUrl() + "/api/trpc",
          headers: () => {
            const headers = new Headers();
            headers.set("x-trpc-source", "nextjs-react");
            return headers;
          },
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
