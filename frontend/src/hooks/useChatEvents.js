import { useContext } from "react";
import { ChatEventsContext } from "../contexts/ChatEventsContext";

export default function useChatEvents() {
    return useContext(ChatEventsContext);
}
