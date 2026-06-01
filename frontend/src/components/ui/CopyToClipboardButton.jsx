import { Copy } from "lucide-react";
import toast from "react-hot-toast";
import { copyText } from "@/utils/clipboard";

export default function CopyToClipboardButton({ text }) {
    const copy = async () => {
        try {
            const res = await copyText(text);
            if (res.ok) toast.success("Copié dans le presse-papier !");
            else toast.error("Impossible de copier.");
        } catch {
            toast.error("Impossible de copier.");
        }
    };

    return (
        <button
            onClick={copy}
            className="px-3 py-1.5 flex items-center gap-2 bg-slate-700 hover:bg-slate-600
                       text-white rounded-md text-sm active:scale-95 transition"
        >
            <Copy size={16} />
            Copier
        </button>
    );
}
