'use client'

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const TOP_EDGE_SCROLL_MAX = 1
const DRAG_START_SLOP = 8
const HORIZONTAL_CANCEL_SLOP = 12
const PULL_DAMPING = 0.58
const MAX_PULL_DISTANCE = 92
const REFRESH_THRESHOLD = 62
const SPIN_DURATION_MS = 880

type PullPhase = 'idle' | 'pulling' | 'refreshing'

type GestureState = {
  isPulling: boolean
  isTracking: boolean
  latestPullDistance: number
  startX: number
  startY: number
}

function createGestureState(): GestureState {
  return {
    isPulling: false,
    isTracking: false,
    latestPullDistance: 0,
    startX: 0,
    startY: 0,
  }
}

function shouldIgnoreGestureTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return true
  }

  return Boolean(
    target.closest(
      [
        'a',
        'button',
        'input',
        'label',
        'select',
        'summary',
        'textarea',
        '[aria-modal="true"]',
        '[contenteditable="true"]',
        '[role="button"]',
        '[role="dialog"]',
        '.photo-lightbox-overlay',
        '.pull-refresh-indicator',
        '.reveal-overlay',
      ].join(','),
    ),
  )
}

function isAtPageTop() {
  const documentScrollTop = document.scrollingElement?.scrollTop ?? 0

  return Math.max(window.scrollY, documentScrollTop) <= TOP_EDGE_SCROLL_MAX
}

function dampenPullDistance(distance: number) {
  return Math.min(MAX_PULL_DISTANCE, Math.max(0, (distance - DRAG_START_SLOP) * PULL_DAMPING))
}

export function PullRefresh({ children }: { children: ReactNode }) {
  const router = useRouter()
  const isRefreshingRef = useRef(false)
  const [phase, setPhase] = useState<PullPhase>('idle')
  const [pullDistance, setPullDistance] = useState(0)
  const [spinKey, setSpinKey] = useState(0)

  useEffect(() => {
    let gesture = createGestureState()
    let resetTimer: number | null = null

    function clearResetTimer() {
      if (resetTimer === null) {
        return
      }

      window.clearTimeout(resetTimer)
      resetTimer = null
    }

    function resetGesture() {
      gesture = createGestureState()
    }

    function resetVisuals() {
      clearResetTimer()
      isRefreshingRef.current = false
      setPhase('idle')
      setPullDistance(0)
    }

    function cancelGesture() {
      resetGesture()

      if (!isRefreshingRef.current) {
        setPhase('idle')
        setPullDistance(0)
      }
    }

    function triggerRefresh() {
      isRefreshingRef.current = true
      resetGesture()
      clearResetTimer()
      setPullDistance(REFRESH_THRESHOLD)
      setPhase('refreshing')
      setSpinKey((current) => current + 1)
      router.refresh()

      resetTimer = window.setTimeout(resetVisuals, SPIN_DURATION_MS)
    }

    function finishGesture({ shouldRefresh }: { shouldRefresh: boolean }) {
      if (shouldRefresh) {
        triggerRefresh()
        return
      }

      cancelGesture()
    }

    function onTouchStart(event: TouchEvent) {
      if (
        isRefreshingRef.current ||
        event.touches.length !== 1 ||
        !isAtPageTop() ||
        shouldIgnoreGestureTarget(event.target)
      ) {
        return
      }

      const touch = event.touches[0]
      gesture = {
        isPulling: false,
        isTracking: true,
        latestPullDistance: 0,
        startX: touch.clientX,
        startY: touch.clientY,
      }
    }

    function onTouchMove(event: TouchEvent) {
      if (!gesture.isTracking) {
        return
      }

      if (event.touches.length !== 1) {
        cancelGesture()
        return
      }

      const touch = event.touches[0]
      const deltaX = touch.clientX - gesture.startX
      const deltaY = touch.clientY - gesture.startY
      const absDeltaX = Math.abs(deltaX)

      if (deltaY < 0 || (absDeltaX > HORIZONTAL_CANCEL_SLOP && absDeltaX > deltaY)) {
        cancelGesture()
        return
      }

      if (deltaY <= DRAG_START_SLOP) {
        return
      }

      if (!isAtPageTop()) {
        cancelGesture()
        return
      }

      if (event.cancelable) {
        event.preventDefault()
      }

      const nextPullDistance = dampenPullDistance(deltaY)
      gesture.isPulling = true
      gesture.latestPullDistance = nextPullDistance
      setPhase('pulling')
      setPullDistance(nextPullDistance)
    }

    function onTouchEnd() {
      if (!gesture.isTracking) {
        return
      }

      finishGesture({
        shouldRefresh: gesture.isPulling && gesture.latestPullDistance >= REFRESH_THRESHOLD,
      })
    }

    function onTouchCancel() {
      if (!gesture.isTracking) {
        return
      }

      cancelGesture()
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      clearResetTimer()
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [router])

  const progress = Math.min(1, pullDistance / REFRESH_THRESHOLD)
  const indicatorStyle = {
    '--pull-refresh-distance': `${Math.round(pullDistance)}px`,
    '--pull-refresh-progress': progress.toFixed(3),
    '--pull-refresh-rotation': `${Math.round(progress * 230)}deg`,
  } as CSSProperties
  const indicatorClassName = [
    'pull-refresh-indicator',
    phase !== 'idle' ? 'is-visible' : '',
    phase === 'pulling' ? 'is-pulling' : '',
    phase === 'refreshing' ? 'is-refreshing' : '',
    progress >= 1 ? 'is-ready' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div className={indicatorClassName} style={indicatorStyle} aria-hidden="true">
        <span key={spinKey} className="pull-refresh-football" />
      </div>
      <span className="pull-refresh-status" aria-live="polite" aria-atomic="true">
        {phase === 'refreshing' ? 'Refreshing scores' : ''}
      </span>
      {children}
    </>
  )
}
