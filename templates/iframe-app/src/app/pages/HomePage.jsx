import { useEffect } from 'react';
import { Box, Button, EmptyState, Flex, Link, Text, useExtensionActions } from '@hubspot/ui-extensions';
import { PageBreadcrumbs, PageTitle } from '@hubspot/ui-extensions/pages';

// HubSpot's UI Extensions runtime does not support an inline <iframe>; the only
// supported mechanism is openIframeModal (a modal dialog). This page opens the
// target URL in that modal automatically on load, and offers a button to reopen
// it if the visitor closes the modal.
//
// openIframeModal's height/width are required fixed pixel numbers — HubSpot's
// API has no percentage or fullscreen option. Reading the real screen size from
// inside this extension's sandboxed iframe (via window.innerWidth/innerHeight,
// then window.screen.availWidth/availHeight) didn't change the rendered modal
// size at all across multiple tests, so neither reflects anything usable here.
// Requesting deliberately oversized values instead relies on the modal being
// clamped to whatever space is actually available — which turned out to be a
// fixed platform maximum well below full screen, confirmed across every size
// tested. So both options are offered: the modal (stays inside HubSpot's UI,
// fixed size) and a plain link that opens the target URL in a real new browser
// tab (leaves HubSpot's UI, but genuinely fills the screen).
const MODAL_HEIGHT = 2000;
const MODAL_WIDTH = 3000;

export const HomePage = () => {
  const { openIframeModal } = useExtensionActions();

  const openTarget = () => {
    openIframeModal({
      uri: '{{targetUrl}}',
      height: MODAL_HEIGHT,
      width: MODAL_WIDTH,
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
        <Flex direction="row" gap="small" align="center">
          <Button onClick={openTarget}>Open {{navLabel}}</Button>
          <Box>
            <Link href="{{targetUrl}}">Open full screen in a new tab</Link>
          </Box>
        </Flex>
      </EmptyState>
    </>
  );
};
