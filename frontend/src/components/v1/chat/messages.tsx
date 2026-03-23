import React from "react";
import { OpenHandsEvent } from "#/types/v1/core";
import { EventMessage } from "./event-message";
import { ChatMessage } from "../../features/chat/chat-message";
import { useOptimisticUserMessageStore } from "#/stores/optimistic-user-message-store";
import { usePlanPreviewEvents } from "./hooks/use-plan-preview-events";

interface MessagesProps {
  messages: OpenHandsEvent[]; // UI events (actions replaced by observations)
  allEvents: OpenHandsEvent[]; // Full event history (for action lookup)
}

export const Messages: React.FC<MessagesProps> = React.memo(
  ({ messages, allEvents }) => {
    const { getOptimisticUserMessage } = useOptimisticUserMessageStore();
    const optimisticUserMessage = getOptimisticUserMessage();
    const planPreviewEventIds = usePlanPreviewEvents(allEvents);

    return (
      <>
        {messages.map((message, index) => (
          <EventMessage
            key={message.id}
            event={message}
            messages={allEvents}
            isLastMessage={messages.length - 1 === index}
            isInLast10Actions={messages.length - 1 - index < 10}
            planPreviewEventIds={planPreviewEventIds}
          />
        ))}

        {optimisticUserMessage && (
          <ChatMessage type="user" message={optimisticUserMessage} />
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.messages.length !== nextProps.messages.length) {
      return false;
    }
    return true;
  },
);

Messages.displayName = "Messages";
