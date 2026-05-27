export const AUTO_POST_FREE_FOR_ALL =
  process.env.NEXT_PUBLIC_AUTO_POST_FREE_FOR_ALL !== "false";

export const AUTO_POST_FREE_DAILY_LIMIT = 1;

export const isAutoPostFreeForAll = () => AUTO_POST_FREE_FOR_ALL;
