interface LoadingCarProps {
  label?: string
}

export function LoadingCar({ label = 'Loading...' }: LoadingCarProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <style>{`
        @keyframes drive-across {
          0% { transform: translateX(-40px); }
          50% { transform: translateX(40px); }
          100% { transform: translateX(-40px); }
        }
        @keyframes bounce-wheel {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
        .loading-car {
          animation: drive-across 1.4s ease-in-out infinite;
        }
      `}</style>
      <div className="relative w-32 h-12 overflow-visible">
        <div className="loading-car text-4xl select-none" role="img" aria-label="Loading">
          🚗
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-300 mt-2" />
      </div>
      <p className="text-sm text-gray-500 mt-3">{label}</p>
    </div>
  )
}
