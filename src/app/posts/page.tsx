// MOTHBALLED: entire file — LinkedIn posts page
// To restore, uncomment all code below and remove the redirect

import { redirect } from 'next/navigation'

export default function PostsPage() {
  redirect('/')
}

// import { redirect } from 'next/navigation'
// import { getServerSession } from 'next-auth'
// import { authOptions } from '@/lib/auth'
// import { db } from '@/lib/db'
// import { Header } from '@/components/header'
// import { LinkedInPostCard } from '@/components/linkedin-post-card'
//
// export default async function PostsPage() {
//   ... full original code ...
// }
