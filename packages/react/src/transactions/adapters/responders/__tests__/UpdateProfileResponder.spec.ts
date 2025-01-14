import { ProfileFragment, ProfileFragmentDoc } from '@lens-protocol/api-bindings';
import {
  createMockApolloClientWithMultipleResponses,
  mockGetProfileQueryMockedResponse,
  mockProfileFragment,
} from '@lens-protocol/api-bindings/mocks';
import {
  mockBroadcastedTransactionData,
  mockUpdateFollowPolicyRequest,
  mockUpdateNftProfileImageRequest,
  mockUpdateOffChainProfileImageRequest,
} from '@lens-protocol/domain/mocks';

import { UpdateProfileResponder } from '../UpdateProfileResponder';

function setupUpdateProfileResponder({
  updatedProfile = mockProfileFragment(),
}: {
  updatedProfile?: ProfileFragment;
}) {
  const apolloClient = createMockApolloClientWithMultipleResponses([
    mockGetProfileQueryMockedResponse({
      request: { profileId: updatedProfile.id },
      profile: updatedProfile,
    }),
  ]);

  const responder = new UpdateProfileResponder(apolloClient);

  return {
    responder,

    get profileFromCache() {
      return apolloClient.cache.readFragment({
        id: apolloClient.cache.identify(updatedProfile),
        fragmentName: 'Profile',
        fragment: ProfileFragmentDoc,
      });
    },
  };
}

describe(`Given the ${UpdateProfileResponder.name}`, () => {
  describe.each([
    {
      requestName: 'UpdateOffChainProfileImageRequest',
      request: mockUpdateOffChainProfileImageRequest(),
    },
    {
      requestName: 'UpdateNftProfileImageRequest',
      request: mockUpdateNftProfileImageRequest(),
    },
    {
      requestName: 'UpdateFollowPolicyRequest',
      request: mockUpdateFollowPolicyRequest(),
    },
  ])(
    `when "${UpdateProfileResponder.prototype.commit.name}" method is invoked with BroadcastedTransactionData<$requestName>`,
    ({ request }) => {
      it(`should update the correct Profile in the Apollo Cache`, async () => {
        const updatedProfile = mockProfileFragment({ id: request.profileId });
        const scenario = setupUpdateProfileResponder({ updatedProfile });

        const txData = mockBroadcastedTransactionData({ request });
        await scenario.responder.commit(txData);

        expect(scenario.profileFromCache).toEqual(updatedProfile);
      });
    },
  );
});
