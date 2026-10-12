import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { regrasDeHeaders } from "./src/lib/headers-seguranca";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // Upload do extrato (até 2 MB + multipart) e confirmação com até 5000 linhas em JSON.
    serverActions: { bodySizeLimit: '4mb' },
  },
  // Headers de segurança em todas as rotas (inclui microphone=(self) para a voz).
  async headers() {
    return regrasDeHeaders();
  },
};

export default withNextIntl(nextConfig);
