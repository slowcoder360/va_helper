import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogInIcon } from "lucide-react";
import Image from "next/image";


export default function Header() {
  return (
    <header className="bg-gradient-to-t from-gray-200 via-gray-100 to-gray-300 bg-opacity-90 backdrop-blur-md shadow-md w-full sticky top-0 z-50">
      <nav className="container mx-auto flex justify-between items-center p-4">
        {/* Logo and Branding */}
        <div className="flex items-center flex-grow space-x-2">
          <Link href="/">
            <Image 
              src="/vaca-logo.png" 
              alt="VACA Logo" 
              className="mr-3" 
              width={50}
              height={50}
            />
          </Link>
          <Link href="/" className="text-4xl font-bold text-primary-950">
            VACAx
          </Link>
        </div>

        {/* Center Navigation Links */}
        <div className="hidden md:flex items-center justify-center space-x-20 flex-grow">
          <a href="#for-veterans" className="text-gray-700 hover:text-primary-600 font-bold">
            For Veterans
          </a>
          <a href="#for-vsos" className="text-gray-700 hover:text-primary-600 font-bold">
            For VSO&apos;s
          </a>
          <a href="#about" className="text-gray-700 hover:text-primary-600 font-bold">
            About
          </a>
        </div>

        {/* Right Side Buttons */}
        <div className="flex items-center justify-end space-x-4 flex-grow">
            <>
              <Link href="/sign-up">
                <Button 
                  className="rounded-lg px-6 py-2 shadow-lg"
                  variant="default"
                >
                  Get Started For Free <LogInIcon className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </>
        </div>
      </nav>
    </header>
  );
}
