import React from "react";
import { useNavigate } from "react-router";
import { useCreateConversation } from "#/hooks/mutation/use-create-conversation";
import { useIsCreatingConversation } from "#/hooks/use-is-creating-conversation";
import { Card } from "#/ui/card";
import { CardTitle } from "#/ui/card-title";
import { Typography } from "#/ui/typography";
import { BrandButton } from "../settings/brand-button";
import { useOptimisticUserMessageStore } from "#/stores/optimistic-user-message-store";

export function PerfAgentCard() {
  const navigate = useNavigate();
  const { mutate: createConversation, isPending, isSuccess } = useCreateConversation();
  const isCreatingConversationElsewhere = useIsCreatingConversation();
  const { setOptimisticUserMessage } = useOptimisticUserMessageStore();

  const isCreating = isPending || isSuccess || isCreatingConversationElsewhere;

  const handleLaunch = () => {
    setOptimisticUserMessage(
      "I want to perform a performance trace analysis. Please help me analyze a trace file. I'll upload the file and provide analysis direction."
    );

    createConversation(
      {
        query:
          "/perf_analyze - Starting performance analysis session. Please upload your trace file and describe what you want to analyze.",
      },
      {
        onSuccess: (data) => {
          navigate(`/conversations/${data.conversation_id}`);
        },
      },
    );
  };

  return (
    <Card className="flex-col p-5 gap-2.5 min-h-[286px] md:min-h-auto w-full">
      <CardTitle
        icon={
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        }
      >
        Performance Agent
      </CardTitle>
      <Typography.Text>
        Upload a trace file (Perfetto, systrace, ftrace, Chrome JSON) and get a
        one-click performance analysis report with CPU hotspots, jank
        detection, and actionable recommendations.
      </Typography.Text>
      <BrandButton
        testId="launch-perf-agent-button"
        variant="primary"
        type="button"
        onClick={handleLaunch}
        isDisabled={isCreating}
        className="w-auto absolute bottom-5 left-5 right-5 font-semibold"
      >
        {isCreating ? "Starting..." : "Launch Performance Agent"}
      </BrandButton>
    </Card>
  );
}
