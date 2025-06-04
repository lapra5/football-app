const nextConfig = {
  reactStrictMode: true,

  experimental: {
    jsonModules: true, // ← これを追加！
  },

  async headers() {
    return [
      {
        source: '/current_month_matches.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/updated_log.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
