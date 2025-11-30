"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

interface User {
    id: string
    name: string
    email: string
    role: string
    picture?: string
}

interface UserContextType {
    user: User | null
    loading: boolean
    refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

    const fetchUser = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/auth/me`, { withCredentials: true })
            if (response.data.authenticated && response.data.user) {
                setUser(response.data.user)
            } else {
                setUser(null)
            }
        } catch (error) {
            console.error('Failed to fetch user:', error)
            setUser(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUser()
    }, [])

    return (
        <UserContext.Provider value={{ user, loading, refreshUser: fetchUser }}>
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    const context = useContext(UserContext)
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider')
    }
    return context
}
