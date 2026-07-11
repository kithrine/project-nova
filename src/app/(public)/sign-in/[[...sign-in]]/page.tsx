import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-12">
      <SignIn />
    </main>
  );
}
