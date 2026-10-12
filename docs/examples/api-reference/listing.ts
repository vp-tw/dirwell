import { createPlainTheme, defineConfig, type ListingPlan } from "@vp-tw/dirwell";

export const listingConfig = defineConfig({
  theme: createPlainTheme(),
  listing(context): ListingPlan {
    return {
      html: context.visibleCount > 500 ? { strategy: "paged", pageSize: 100 } : { strategy: "all" },
      data:
        context.dataBytes > 256 * 1024
          ? { strategy: "blocks", blockSize: 200 }
          : { strategy: "all" },
    };
  },
});
