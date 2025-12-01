import React from 'react';

interface TabsProps {
    defaultValue: string;
    className?: string;
    children: React.ReactNode;
}

interface TabsListProps {
    children: React.ReactNode;
    className?: string;
}

interface TabsTriggerProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}

interface TabsContentProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}

// Context to share state
const TabsContext = React.createContext<{
    activeTab: string;
    setActiveTab: (value: string) => void;
} | null>(null);

export function Tabs({ defaultValue, children, className = "" }: TabsProps) {
    const [activeTab, setActiveTab] = React.useState(defaultValue);

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={className}>
                {children}
            </div>
        </TabsContext.Provider>
    );
}

export function TabsList({ children, className = "" }: TabsListProps) {
    return (
        <div className={`inline-flex h-10 items-center justify-center rounded-md bg-gray-100 dark:bg-white/5 p-1 text-gray-500 dark:text-gray-400 ${className}`}>
            {children}
        </div>
    );
}

export function TabsTrigger({ value, children, className = "" }: TabsTriggerProps) {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsTrigger must be used within Tabs");

    const isActive = context.activeTab === value;

    return (
        <button
            className={`
                inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
                ${isActive 
                    ? "bg-white dark:bg-gray-800 text-gray-950 dark:text-white shadow-sm" 
                    : "hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-gray-200"}
                ${className}
            `}
            onClick={() => context.setActiveTab(value)}
        >
            {children}
        </button>
    );
}

export function TabsContent({ value, children, className = "" }: TabsContentProps) {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsContent must be used within Tabs");

    if (context.activeTab !== value) return null;

    return (
        <div className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-fade-in ${className}`}>
            {children}
        </div>
    );
}
