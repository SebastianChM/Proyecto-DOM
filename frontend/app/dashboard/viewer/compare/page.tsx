"use client"

import { useEffect, useRef, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useUser } from "@/context/UserContext"
import { showError } from "@/lib/error-handler"

declare global {
    interface Window {
        Autodesk: any
        THREE: any
    }
}

function CompareViewerContent() {
    const viewerRef = useRef<HTMLDivElement>(null)
    const viewerInstanceRef = useRef<any>(null)
    const searchParams = useSearchParams()
    const router = useRouter()
    const { user } = useUser()

    const primaryUrn = searchParams.get('primary')
    const diffUrn = searchParams.get('diff')
    const fileId = searchParams.get('file')
    const type = searchParams.get('type') || '3d' // '2d' or '3d'

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!primaryUrn || !diffUrn || !viewerRef.current) {
            const msg = 'Missing required parameters'
            setError(msg)
            showError(new Error(msg), user?.role, "Comparison Error")
            setLoading(false)
            return
        }

        const initViewer = async () => {
            try {
                // Load Autodesk Viewer scripts if not already loaded
                if (!window.Autodesk) {
                    await loadViewerScripts()
                }

                // Fetch token first
                const res = await fetch('http://localhost:8080/api/viewer/token')
                if (!res.ok) throw new Error('Failed to fetch viewer token')
                const tokenData = await res.json()
                const token = tokenData.access_token

                const options = {
                    env: "AutodeskProduction",
                    accessToken: token,
                    isAEC: true
                }

                window.Autodesk.Viewing.Initializer(options, async () => {
                    try {
                        const viewer = new window.Autodesk.Viewing.GuiViewer3D(viewerRef.current!)
                        viewerInstanceRef.current = viewer

                        const startedCode = viewer.start()
                        if (startedCode > 0) {
                            const msg = 'Failed to create a Viewer: WebGL not supported.'
                            setError('WebGL is not supported in your browser')
                            showError(new Error(msg), user?.role, "Viewer Initialization Error")
                            return
                        }

                        // console.log(`Viewer initialized, mode: ${type}`)

                        const formatUrn = (urn: string) => urn.startsWith('urn:') ? urn : `urn:${urn}`;
                        const documentId1 = formatUrn(primaryUrn);
                        const documentId2 = formatUrn(diffUrn);

                        // Load both models first
                        const loadModel = (urn: string, options: any = {}) => {
                            return new Promise((resolve, reject) => {
                                window.Autodesk.Viewing.Document.load(
                                    urn,
                                    (doc: any) => {
                                        const defaultModel = doc.getRoot().getDefaultGeometry()
                                        viewer.loadDocumentNode(doc, defaultModel, options)
                                            .then((model: any) => resolve(model))
                                            .catch((err: any) => reject(err))
                                    },
                                    (errorCode: any) => reject(errorCode)
                                )
                            })
                        }

                        try {
                            // console.log('Loading primary model...')
                            const model1 = await loadModel(documentId1)
                            
                            // console.log('Loading secondary model...')
                            const model2 = await loadModel(documentId2, { 
                                keepCurrentModels: true, 
                                placementTransform: (new window.THREE.Matrix4()).identity() 
                            })

                            // console.log('Both models loaded. Initializing comparison...')

                            // Wait a bit for geometry to settle
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            if (type === '2d') {
                                // Use PixelCompare for 2D sheets (PDFs)
                                // console.log('Loading PixelCompare extension...')
                                const pixelCompare = await viewer.loadExtension("Autodesk.Viewing.PixelCompare")
                                if (pixelCompare) {
                                    pixelCompare.compareTwoModels(model1, model2)
                                    setLoading(false)
                                } else {
                                    throw new Error("Failed to load PixelCompare extension")
                                }
                            } else {
                                // Use DiffTool for 3D and complex 2D (DWG)
                                // console.log('Loading DiffTool extension...')
                                const diffConfig = {
                                    primaryModels: [model1],
                                    diffModels: [model2],
                                    versionA: "2",
                                    versionB: "1",
                                    mimeType: "application/vnd.autodesk.autocad.dwg", // Adjust based on actual file type if needed
                                    diffMode: "overlay"
                                }
                                
                                const diffTool = await viewer.loadExtension("Autodesk.DiffTool", diffConfig)
                                if (diffTool) {
                                    // console.log('DiffTool loaded, activating...')
                                    diffTool.activate()
                                    setLoading(false)
                                } else {
                                    throw new Error("Failed to load DiffTool extension")
                                }
                            }

                        } catch (loadErr) {
                            handleLoadError(loadErr, 'models')
                        }

                    } catch (error) {
                        setError('Failed to initialize 3D viewer')
                        showError(error, user?.role, "Viewer Initialization Error")
                        setLoading(false)
                    }
                })
            } catch (error) {
                setError('Failed to load viewer scripts')
                showError(error, user?.role, "Script Loading Error")
                setLoading(false)
            }
        }

        initViewer()

        return () => {
            if (viewerInstanceRef.current) {
                viewerInstanceRef.current.finish()
                viewerInstanceRef.current = null
            }
        }
    }, [primaryUrn, diffUrn, type, user?.role])

    const handleLoadError = (errorCode: any, model: string) => {
        const msg = errorCode === 7 ? 'Model not found or invalid URN' : `Failed to load ${model} model (Error ${errorCode})`
        setError(msg)
        showError(new Error(msg), user?.role, "Model Loading Error")
        setLoading(false)
    }

    const loadViewerScripts = () => {
        return new Promise((resolve, reject) => {
            if (window.Autodesk) {
                resolve(true)
                return
            }
            const link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/style.min.css'
            document.head.appendChild(link)

            const script = document.createElement('script')
            script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.97/viewer3D.min.js'
            script.onload = () => resolve(true)
            script.onerror = () => reject(new Error('Failed to load viewer script'))
            document.head.appendChild(script)
        })
    }

    const handleBack = () => {
        if (fileId) {
            router.push(`/dashboard/files/${fileId}`)
        } else {
            router.back()
        }
    }

    if (error) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <div className="text-center">
                    <p className="text-red-500 text-xl font-semibold mb-4">{error}</p>
                    <Button onClick={handleBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Go Back
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex flex-col">
            <div className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="icon" onClick={handleBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold dark:text-white">
                            {type === '2d' ? 'PDF Comparison' : 'Model Comparison'}
                        </h1>
                        <p className="text-sm dark:text-gray-400 text-gray-600">
                            {type === '2d'
                                ? 'Comparing PDF versions using PixelCompare'
                                : 'Comparing 3D models using DiffTool'}
                        </p>
                    </div>
                </div>

                {loading && (
                    <div className="flex items-center space-x-2 text-sm dark:text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading comparison...</span>
                    </div>
                )}
            </div>
            <div ref={viewerRef} className="flex-1 w-full" />
        </div>
    )
}

export default function CompareViewerPage() {
    return (
        <Suspense fallback={
            <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <div className="flex items-center space-x-2 text-sm dark:text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Loading viewer...</span>
                </div>
            </div>
        }>
            <CompareViewerContent />
        </Suspense>
    )
}
