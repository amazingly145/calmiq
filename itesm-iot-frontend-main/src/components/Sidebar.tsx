import React, {JSX} from "react";
import {HeartIcon, HistoryIcon, HomeIcon, StarIcon} from "lucide-react";

export interface Button {
    name: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
}

const buttons: Button[] =[
    {
        name: "Home",
        icon: HomeIcon,
    },
    {
        name: "History",
        icon: HistoryIcon,
    },
    {
        name: "Health",
        icon: HeartIcon,
    },
    {
        name: "Recommendations",
        icon: StarIcon,
    }
];

export default function Sidebar() {
    return (
        <div className="flex flex-col w-full h-full bg-gray-100 rounded-md">
            <p className="font-bold text-xl leading-tight text-black p-4">
                Calmiq
            </p>
            {buttons.map((button, i) =>
                <div key={i} className="flex flex-row items-center align-middle gap-4 hover:bg-gray-200 ml-2 mr-2 p-4 rounded-md cursor-pointer">
                    <button.icon className="text-black font-bold"/>
                    <p className="text-black font-bold">
                        {button.name}
                    </p>
                </div>)
            }
        </div>
    );
}