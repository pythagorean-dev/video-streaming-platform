'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon, UserCircleIcon, VideoCameraIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-gray-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <VideoCameraIcon className="h-8 w-8 text-blue-500" />
            <h1 className="ml-2 text-xl font-bold text-white">VideoStream Pro</h1>
          </div>

          <div className="hidden md:block flex-1 max-w-lg mx-8">
            <div className="relative">
              <input
                type="text"
                placeholder="Videos suchen..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <a href="/upload" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors">
              Video hochladen
            </a>
            <UserCircleIcon className="h-8 w-8 text-gray-300 hover:text-white cursor-pointer" />
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
            >
              {isMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <div className="relative mb-3">
                <input
                  type="text"
                  placeholder="Videos suchen..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400"
                />
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              <a href="/upload" className="block w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium mb-2 text-center">
                Video hochladen
              </a>
              <button className="w-full text-left px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg">
                Profil
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}