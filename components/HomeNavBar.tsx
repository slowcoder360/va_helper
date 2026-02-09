"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";

const HomeNavBar = () => {
  return (
    <header className="bg-gradient-to-t from-gray-200 via-gray-100 to-gray-300 bg-opacity-90 backdrop-blur-md shadow-md w-full sticky top-0 z-50">
      <nav className="flex justify-between items-center p-4">
        
        {/* Logo and Name */}
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Image 
              src="/vaca-logo.png" // Adjust the path to your logo
              alt="VACAx Logo"
              width={40}  // Adjust size as needed
              height={40}
            />
          </Link>
          <h1 className="text-3xl font-bold text-primary-950">VACAx</h1>
        </div>

        {/* User Button */}
        <div>
          <UserButton />
        </div>
      </nav>
    </header>
  );
};

export default HomeNavBar;
