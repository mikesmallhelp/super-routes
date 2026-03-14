"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function LoginScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 text-center space-y-4">
          <h1 className="text-2xl font-bold text-primary">Tehoreitit</h1>
          <p className="text-sm text-muted-foreground">
            Seuraa joukkoliikenteen reittejä reaaliaikaisesti
          </p>
          <Button onClick={() => signIn("google")} className="w-full">
            Kirjaudu Google-tilillä
          </Button>
          <p className="text-xs text-muted-foreground">
            Kirjautumalla hyväksyt{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              tietosuojaselosteen
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
