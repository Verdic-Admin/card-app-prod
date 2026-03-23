'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { X, Crop as CropIcon, Loader2 } from 'lucide-react'

interface CropModalProps {
  imageFile: File
  side: 'front' | 'back'
  onConfirm: (newFile: File) => void
  onClose: () => void
}

function centerDefaultCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, 2 / 3, width, height),
    width,
    height
  )
}

async function cropImageToFile(
  imgEl: HTMLImageElement,
  pixelCrop: PixelCrop,
  originalFile: File
): Promise<File> {
  const canvas = document.createElement('canvas')
  const scaleX = imgEl.naturalWidth / imgEl.width
  const scaleY = imgEl.naturalHeight / imgEl.height
  canvas.width = Math.round(pixelCrop.width * scaleX)
  canvas.height = Math.round(pixelCrop.height * scaleY)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    imgEl,
    Math.round(pixelCrop.x * scaleX),
    Math.round(pixelCrop.y * scaleY),
    Math.round(pixelCrop.width * scaleX),
    Math.round(pixelCrop.height * scaleY),
    0,
    0,
    canvas.width,
    canvas.height
  )
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/jpeg', 0.95)
  )
  return new File([blob], originalFile.name, { type: 'image/jpeg' })
}

export function CropModal({ imageFile, side, onConfirm, onClose }: CropModalProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [isProcessing, setIsProcessing] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const objectUrlRef = useRef<string>('')

  // Create object URL once and revoke on unmount
  useEffect(() => {
    const url = URL.createObjectURL(imageFile)
    objectUrlRef.current = url
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(centerDefaultCrop(width, height))
  }, [])

  const handleConfirm = async () => {
    if (!completedCrop || !imgRef.current) return
    if (completedCrop.width < 10 || completedCrop.height < 10) return
    setIsProcessing(true)
    try {
      const newFile = await cropImageToFile(imgRef.current, completedCrop, imageFile)
      onConfirm(newFile)
    } catch (err) {
      console.error('Crop failed:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CropIcon className="w-4 h-4 text-indigo-500" />
              Re-Crop — {side === 'front' ? 'Front' : 'Back'} Image
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Draw a box over the card to define the new crop. The padded raw backup is shown below.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Crop area — scrollable */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-900 p-4">
          {objectUrlRef.current && (
            <ReactCrop
              crop={crop}
              onChange={c => setCrop(c)}
              onComplete={c => setCompletedCrop(c)}
              className="max-w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={objectUrlRef.current}
                alt="Raw backup for cropping"
                onLoad={onImageLoad}
                className="max-h-[60vh] object-contain"
              />
            </ReactCrop>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 flex-shrink-0 bg-slate-50">
          <p className="text-xs font-semibold text-slate-500">
            {completedCrop
              ? `Crop: ${Math.round(completedCrop.width)} × ${Math.round(completedCrop.height)} px`
              : 'Drag to define your crop region'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!completedCrop || completedCrop.width < 10 || isProcessing}
              className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                : <><CropIcon className="w-4 h-4" /> Confirm Crop</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
