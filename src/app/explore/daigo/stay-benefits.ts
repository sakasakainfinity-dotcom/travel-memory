export type DaigoStayBenefit = {
  id: string;
  name: string;
  image?: string;
  benefit?: string;
  condition?: string;
  address?: string;
  hours?: string;
  link?: string;
  recruiting?: boolean;
};

/** Public catalogue data, ready to be replaced by an API or CMS later. */
export const daigoStayBenefits: DaigoStayBenefit[] = [
  {
    id: "machiyado-motomachi",
    name: "まちやど Motomachi",
    image: "/motomachi.jpg",
    benefit: "お会計から500円OFF",
    condition: "対象店舗で3,000円以上のお会計・1滞在につき1回まで",
    address: "茨城県久慈郡大子町大子650",
    link: "https://daigo-machiyado.jp/",
  },
  ...Array.from({ length: 5 }, (_, index) => ({
    id: `partner-recruiting-${index + 1}`,
    name: "参加店舗募集中",
    recruiting: true as const,
  })),
];
