/**
 * Loading skeleton shown while the Forms Mode chunk (including Syncfusion
 * PDF Viewer + CSS) is being loaded via React.lazy / Suspense.
 */
export default function FormsSkeleton() {
  return (
    <div className="flex h-full animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-[250px] shrink-0 border-r border-slate-700 bg-surface-800 p-4 space-y-3">
        <div className="h-5 w-24 bg-slate-700 rounded" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 bg-slate-700/50 rounded" />
          ))}
        </div>
      </div>
      {/* Viewer skeleton */}
      <div className="flex-1 flex items-center justify-center bg-surface-900">
        <div className="text-center space-y-3">
          <div className="h-[600px] w-[460px] bg-slate-800 rounded-lg mx-auto" />
          <div className="h-4 w-40 bg-slate-700 rounded mx-auto" />
        </div>
      </div>
    </div>
  );
}
