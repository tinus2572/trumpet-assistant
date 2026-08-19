"use client";

interface PistonDisplayProps {
  pistons: [boolean, boolean, boolean];
  fingeringLabel: string;
}

export default function PistonDisplay({ pistons, fingeringLabel }: PistonDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4">
        {pistons.map((pressed, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={`relative w-14 h-24 rounded-lg border-2 transition-all duration-150 ${
                pressed
                  ? "border-amber-400 bg-amber-500/20 shadow-lg shadow-amber-500/20"
                  : "border-zinc-600 bg-zinc-800"
              }`}
            >
              {/* Valve stem */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 w-3 rounded-full transition-all duration-150 ${
                  pressed
                    ? "bg-amber-400 top-8 h-12"
                    : "bg-zinc-500 top-2 h-12"
                }`}
              />
              {/* Valve cap */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 w-10 h-5 rounded-t-full transition-all duration-150 ${
                  pressed
                    ? "bg-amber-400 top-6"
                    : "bg-zinc-400 top-0"
                }`}
              />
            </div>
            <span className={`text-sm font-bold ${pressed ? "text-amber-400" : "text-zinc-500"}`}>
              {i + 1}
            </span>
          </div>
        ))}
      </div>
      <span className="text-sm text-zinc-400 font-medium">{fingeringLabel}</span>
    </div>
  );
}
