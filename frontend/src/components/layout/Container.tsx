export function Container({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-fluid-sm md:px-fluid-md lg:px-fluid-lg ${className}`}>
      {children}
    </div>
  );
}
