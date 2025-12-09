        // Для логирования
        middleware: [
        {
          matcher: "/store/customers/me",
          middlewares: [logAuthMiddleware]
        },
        {
          matcher: "/store/customers/me/*",
          middlewares: [logAuthMiddleware]
        },

  
  modules: [
    {
      resolve: "@medusajs/medusa/auth",
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
          {
            resolve: "./src/modules/yandex-auth",
            id: "yandex",
            options: {
              clientId: process.env.YANDEX_CLIENT_ID,
              clientSecret: process.env.YANDEX_CLIENT_SECRET,
              callbackUrl: process.env.YANDEX_CALLBACK_URL,
            },
          },
        ],
      },
    },
