import TownBingoPlayer from "./town-bingo-player";
export default function Page({params}:{params:{slug:string}}){return <TownBingoPlayer slug={params.slug}/>;}
