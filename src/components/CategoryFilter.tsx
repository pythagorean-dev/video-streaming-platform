'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useRef, useState } from 'react';

interface Category {
  id: string;
  name: string;
  active: boolean;
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
}

export default function CategoryFilter({ categories, selectedCategory, onCategoryChange }: CategoryFilterProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    const newScrollLeft = direction === 'left' 
      ? container.scrollLeft - scrollAmount
      : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });

    // Update scroll button states after animation
    setTimeout(() => {
      updateScrollButtons();
    }, 300);
  };

  const updateScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth
    );
  };

  const handleScroll = () => {
    updateScrollButtons();
  };

  return (
    <div className="sticky top-16 bg-gray-900 z-40 py-4 border-b border-gray-800">
      <div className="relative flex items-center">
        {/* Left Scroll Button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 z-10 bg-gray-800 hover:bg-gray-700 rounded-full p-2 shadow-lg transition-colors"
          >
            <ChevronLeftIcon className="h-5 w-5 text-white" />
          </button>
        )}

        {/* Categories */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex space-x-3 overflow-x-auto scrollbar-hide px-8"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              className={`
                flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap
                ${selectedCategory === category.id
                  ? 'bg-white text-gray-900 shadow-lg'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                }
              `}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Right Scroll Button */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 z-10 bg-gray-800 hover:bg-gray-700 rounded-full p-2 shadow-lg transition-colors"
          >
            <ChevronRightIcon className="h-5 w-5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}