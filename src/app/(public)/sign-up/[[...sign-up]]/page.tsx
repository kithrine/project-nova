import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-12">
      <SignUp />
    </main>
  );
}
