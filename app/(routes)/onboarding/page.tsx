// app/onboarding/page.tsx

import { OnboardingForm } from "@/components/OnboardingForm";

const OnboardingPage = () => {
  return (
    <div className="h-screen flex flex-col items-center justify-start py-12 sm:px-6 lg:px-8 bg-gray-50 overflow-y-auto">
      <div className="w-full max-w-4xl text-center px-6"> 
        <h1 className="text-4xl font-bold text-primary-950">Welcome to VACAx</h1>
        <p className="mt-4 text-black text-lg">
          Please complete your profile to continue. All information is encrypted and protected. We won’t use your data for any other purposes, and you can delete your information anytime by visiting the settings page.
        </p>
      </div>

      <div className="mt-8 w-full max-w-4xl sm:px-10 mb-10">
        <OnboardingForm />
      </div>
    </div>
  );
};

export default OnboardingPage;
