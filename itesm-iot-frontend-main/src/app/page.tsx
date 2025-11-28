import Topbar from "@/components/Topbar";
import ContentIsland from "@/components/ContentIsland";

export default function Main() {
    return (
        <>
            <div className="flex flex-col w-screen h-screen bg-white">
                <div className="flex flex-col w-full h-1/12 p-4 pb-2">
                    <Topbar/>
                </div>

                <div className="w-full h-full p-4 pt-2 gap-4">
                    <div className="flex flex-row w-full h-full">
                        <ContentIsland/>
                    </div>
                </div>

            </div>
        </>
    );
}