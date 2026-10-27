import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

import { AuthShell } from "@/src/components/auth/AuthShell";
import { isClerkEnabled } from "@/src/lib/clerk/config";

/** Signed in, but no Renvani workspace/role is linked to this account. Never redirects back into the app. */
export default function NoAccessPage() {
  return (
    <AuthShell>
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold">No workspace access yet</h1>
        <p className="mt-2 text-sm text-gray-600">
          Your account is signed in but isn&apos;t linked to a Renvani workspace. Ask your shop owner for an invite, or sign out and use another account.
        </p>
        <div className="mt-6">
          {isClerkEnabled() ? (
            <SignOutButton redirectUrl="/login">
              <button type="button" className="min-h-[44px] rounded-full bg-black px-5 text-white">Sign out</button>
            </SignOutButton>
          ) : (
            <Link href="/login" className="underline">Back to sign in</Link>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
