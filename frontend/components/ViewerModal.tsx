"use client"

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import dynamic from 'next/dynamic'
import { Button } from "@/components/ui/button"
import { Maximize2 } from "lucide-react"
import Link from "next/link"

// Dynamically import Viewer to avoid SSR issues
const Viewer = dynamic(() => import('@/components/Viewer'), { ssr: false })

interface ViewerModalProps {
    isOpen: boolean
    onClose: () => void
    file: {
        id: string
        name: string
        apsUrn: string | null
        type: string
    } | null
    token?: string
}

export function ViewerModal({ isOpen, onClose, file, token }: ViewerModalProps) {
    if (!file) return null

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[90vw] h-[90vh] p-0 gap-0 bg-gray-900 border-white/10 flex flex-col">
                <DialogDescription className="sr-only">
                    Viewer modal for {file.name}
                </DialogDescription>
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gray-900">
                    <DialogTitle className="text-white flex items-center gap-2">
                        <span className="font-normal text-gray-400">Viewing:</span>
                        {file.name}
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        <Link href={`/dashboard/viewer/${file.id}`}>
                            <Button variant="outline" size="sm" className="h-8 text-xs border-white/20 text-white hover:bg-white/10">
                                <Maximize2 className="h-3 w-3 mr-1" />
                                Full Page
                            </Button>
                        </Link>
                    </div>
                </div>
                <div className="flex-1 relative bg-black overflow-hidden">
                    {file.type.toLowerCase().includes('pdf') ? (
                        <iframe
                            src={`/api/files/${file.id}/download`}
                            className="w-full h-full border-none"
                            title="PDF Viewer"
                        />
                    ) : file.apsUrn ? (
                        <Viewer urn={file.apsUrn} token={token} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            File is not ready for viewing
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
