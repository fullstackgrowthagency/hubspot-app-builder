import { useEffect } from 'react';
import { Button, EmptyState, Text, useExtensionActions } from '@hubspot/ui-extensions';
import { PageBreadcrumbs, PageTitle } from '@hubspot/ui-extensions/pages';

// HubSpot's UI Extensions runtime does not support an inline <iframe>; the only
// supported mechanism is openIframeModal (a modal dialog). This page opens the
// target URL in that modal automatically on load, and offers a button to reopen
// it if the visitor closes the modal.
//
// openIframeModal's height/width are required fixed pixel numbers — HubSpot's
// API has no percentage or fullscreen option. This extension itself runs inside
// HubSpot's own embedding iframe, so window.innerWidth/innerHeight here reflect
// that embedding frame's size, not the actual browser window (confirmed: sizing
// off innerWidth/innerHeight opened the same modest size as the old hardcoded
// value). window.screen reflects the physical display instead, and — unlike
// reaching into a parent frame — is readable from any frame regardless of
// nesting or cross-origin embedding, so it actually tracks the viewer's real
// screen. Leave a margin for the modal's own chrome rather than requesting the
// exact screen size.
function modalSize() {
  if (typeof window === 'undefined' || !window.screen) return { height: 900, width: 1400 };
  return {
    height: Math.floor(window.screen.availHeight * 0.9),
    width: Math.floor(window.screen.availWidth * 0.95)
  };
}

export const HomePage = () => {
  const { openIframeModal } = useExtensionActions();

  const openTarget = () => {
    openIframeModal({
      uri: '{{targetUrl}}',
      ...modalSize(),
      title: '{{navLabel}}',
      flush: true
    });
  };

  useEffect(() => {
    openTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageBreadcrumbs>
        <PageBreadcrumbs.Current>{{navLabel}}</PageBreadcrumbs.Current>
      </PageBreadcrumbs>
      <PageTitle>{{navLabel}}</PageTitle>
      <EmptyState title="{{navLabel}}" layout="vertical">
        <Text>{{description}}</Text>
        <Button onClick={openTarget}>Open {{navLabel}}</Button>
      </EmptyState>
    </>
  );
};
