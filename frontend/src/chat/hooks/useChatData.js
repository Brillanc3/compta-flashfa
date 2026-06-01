// FRONTEND — src/chat/hooks/useChatData.js
import { useEffect } from "react";
import * as chatService from "@/services/chatService";
import { useChatStore } from "../store/useChatStore";

export function useChatData(companyId) {
    const setCategories = useChatStore(s => s.setCategories);
    const setChannels = useChatStore(s => s.setChannels);

    useEffect(() => {
        if (!companyId) return;

        async function load() {
            const categories = await chatService.getCategories(companyId);
            const channels   = await chatService.getChannels(companyId);

            setCategories(categories);
            setChannels(channels);
        }

        load();
    }, [companyId, setCategories, setChannels]);
}
