"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-8" />;
  }

  if (!session) {
    return (
      <Button onClick={() => signIn("google")} size="sm" variant="outline">
        Kirjaudu
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
        {session.user?.email}
      </span>
      <Button onClick={() => signOut()} size="sm" variant="outline">
        Ulos
      </Button>
    </div>
  );
}
