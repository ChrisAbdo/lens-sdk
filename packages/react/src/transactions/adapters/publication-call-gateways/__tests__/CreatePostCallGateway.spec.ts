import { faker } from '@faker-js/faker';
import { LensApolloClient, omitTypename, PublicationMainFocus } from '@lens-protocol/api-bindings';
import {
  createMockApolloClientWithMultipleResponses,
  mockCreatePostTypedDataMutation,
  mockRelayerResultFragment,
  createCreatePostTypedDataMutationMockedResponse,
  createCreatePostViaDispatcherMutationMockedResponse,
} from '@lens-protocol/api-bindings/mocks';
import { NativeTransaction } from '@lens-protocol/domain/entities';
import { mockNonce, mockCreatePostRequest } from '@lens-protocol/domain/mocks';
import { CreatePostRequest } from '@lens-protocol/domain/use-cases/publications';
import { ChainType } from '@lens-protocol/shared-kernel';

import { UnsignedLensProtocolCall } from '../../../../wallet/adapters/ConcreteWallet';
import { FailedUploadError, MetadataUploadAdapter } from '../../MetadataUploadAdapter';
import { mockITransactionFactory } from '../../__helpers__/mocks';
import { CreatePostCallGateway } from '../CreatePostCallGateway';
import {
  createBasicExerciseData,
  createFeeCollectModuleExerciseData,
  createFeeCollectModuleFollowersOnlyExerciseData,
  createRevertCollectModuleExerciseData,
  createFollowerOnlyReferenceModuleExerciseData,
  createFreeCollectModuleExerciseData,
  createFreeCollectModuleFollowersOnlyExerciseData,
  createLimitedFeeCollectModuleExerciseData,
  createLimitedFeeCollectModuleFollowersOnlyExerciseData,
  createLimitedTimedFeeCollectModuleExerciseData,
  createLimitedTimedFeeCollectModuleFollowersOnlyExerciseData,
  createSupportedNFTAttributesExerciseData,
  createTimedFeeCollectModuleExerciseData,
  createTimedFeeCollectModuleFollowersOnlyExerciseData,
  PublicationExerciseData,
} from '../__helpers__/publication-exercise-data';

function setupTestScenario({
  apolloClient,
  contentURI,
}: {
  apolloClient: LensApolloClient;
  contentURI?: string;
}) {
  const transactionFactory = mockITransactionFactory();
  const uploadSpy = jest.fn();

  if (contentURI) {
    uploadSpy.mockResolvedValue(contentURI);
  } else {
    uploadSpy.mockRejectedValue(new Error('Unknown error'));
  }

  const gateway = new CreatePostCallGateway(
    apolloClient,
    transactionFactory,
    new MetadataUploadAdapter(uploadSpy),
  );

  return { gateway, uploadSpy };
}

const mandatoryFallbackMetadata = (request: CreatePostRequest) => ({
  metadata_id: expect.any(String),
  version: '2.0.0',

  attributes: [],
  name: 'none', // although "name" is not needed when a publication is not collectable, out Publication Metadata V2 schema requires it ¯\_(ツ)_/¯

  locale: request.locale,
  mainContentFocus: PublicationMainFocus[request.contentFocus],
});

describe(`Given an instance of ${CreatePostCallGateway.name}`, () => {
  describe.each<{
    description: string;
    createExerciseData: () => PublicationExerciseData;
  }>([
    {
      description:
        'locale, content focus, text, media content and basic metadata (name, description)',
      createExerciseData: createBasicExerciseData,
    },
    {
      description: 'all supported NFT attribute types',
      createExerciseData: createSupportedNFTAttributesExerciseData,
    },
    {
      description: 'Follower Only Reference Module',
      createExerciseData: createFollowerOnlyReferenceModuleExerciseData,
    },
    {
      description: 'Revert Collect Module',
      createExerciseData: createRevertCollectModuleExerciseData,
    },
    {
      description: 'Free Collect Module (anybody)',
      createExerciseData: createFreeCollectModuleExerciseData,
    },
    {
      description: 'Free Collect Module (followers only)',
      createExerciseData: createFreeCollectModuleFollowersOnlyExerciseData,
    },
    {
      description: 'Fee Collect Module (anybody)',
      createExerciseData: createFeeCollectModuleExerciseData,
    },
    {
      description: 'Fee Collect Module (followers only)',
      createExerciseData: createFeeCollectModuleFollowersOnlyExerciseData,
    },
    {
      description: 'Limited Fee Collect Module (anybody)',
      createExerciseData: createLimitedFeeCollectModuleExerciseData,
    },
    {
      description: 'Limited Fee Collect Module (followers only)',
      createExerciseData: createLimitedFeeCollectModuleFollowersOnlyExerciseData,
    },
    {
      description: 'Timed Fee Collect Module (anybody)',
      createExerciseData: createTimedFeeCollectModuleExerciseData,
    },
    {
      description: 'Timed Fee Collect Module (followers only)',
      createExerciseData: createTimedFeeCollectModuleFollowersOnlyExerciseData,
    },
    {
      description: 'Limited Timed Fee Collect Module (anybody)',
      createExerciseData: createLimitedTimedFeeCollectModuleExerciseData,
    },
    {
      description: 'Limited Timed Fee Collect Module (followers only)',
      createExerciseData: createLimitedTimedFeeCollectModuleFollowersOnlyExerciseData,
    },
  ])(`and $description`, ({ createExerciseData }) => {
    const { requestVars, expectedMutationRequestDetails, expectedMetadata } = createExerciseData();
    const request = mockCreatePostRequest(requestVars);
    const contentURI = faker.internet.url();

    describe(`when creating an ${UnsignedLensProtocolCall.name}<CreatePostRequest>`, () => {
      it(`should:
            - upload the expected publication metadata
            - create an instance of the ${UnsignedLensProtocolCall.name} with the expected typed data`, async () => {
        const createPostTypedDataMutation = mockCreatePostTypedDataMutation();
        const apolloClient = createMockApolloClientWithMultipleResponses([
          createCreatePostTypedDataMutationMockedResponse({
            variables: {
              request: {
                profileId: request.profileId,
                contentURI,
                ...expectedMutationRequestDetails,
              },
            },
            data: createPostTypedDataMutation,
          }),
        ]);
        const { gateway, uploadSpy } = setupTestScenario({ apolloClient, contentURI });

        const unsignedCall = await gateway.createUnsignedProtocolCall(request);

        expect(uploadSpy).toHaveBeenCalledWith({
          ...mandatoryFallbackMetadata(request),
          ...expectedMetadata,
        });
        expect(unsignedCall).toBeInstanceOf(UnsignedLensProtocolCall);
        expect(unsignedCall.typedData).toEqual(
          omitTypename(createPostTypedDataMutation.result.typedData),
        );
      });

      it(`should be possible to override the signature nonce`, async () => {
        const nonce = mockNonce();
        const apolloClient = createMockApolloClientWithMultipleResponses([
          createCreatePostTypedDataMutationMockedResponse({
            variables: {
              request: {
                profileId: request.profileId,
                contentURI,
                ...expectedMutationRequestDetails,
              },
              options: {
                overrideSigNonce: nonce,
              },
            },
            data: mockCreatePostTypedDataMutation({ nonce }),
          }),
        ]);
        const { gateway } = setupTestScenario({ apolloClient, contentURI });

        const unsignedCall = await gateway.createUnsignedProtocolCall(request, nonce);

        expect(unsignedCall.nonce).toEqual(nonce);
      });

      it(`should throw a ${FailedUploadError.name} if the Publication Metadata upload fails`, async () => {
        const apolloClient = createMockApolloClientWithMultipleResponses([]);
        const { gateway } = setupTestScenario({ apolloClient });

        await expect(() => gateway.createUnsignedProtocolCall(request)).rejects.toThrow(
          FailedUploadError,
        );
      });
    });

    describe(`when creating a ${NativeTransaction.name}<CreatePostRequest>}" method`, () => {
      it(`should create an instance of the ${NativeTransaction.name}`, async () => {
        const apolloClient = createMockApolloClientWithMultipleResponses([
          createCreatePostViaDispatcherMutationMockedResponse({
            variables: {
              request: {
                profileId: request.profileId,
                contentURI,
                ...expectedMutationRequestDetails,
              },
            },
            data: {
              result: mockRelayerResultFragment(),
            },
          }),
        ]);
        const { gateway } = setupTestScenario({ apolloClient, contentURI });

        const transaction = await gateway.createDelegatedTransaction(request);

        await transaction.waitNextEvent();
        expect(transaction).toBeInstanceOf(NativeTransaction);
        expect(transaction).toEqual(
          expect.objectContaining({
            chainType: ChainType.POLYGON,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            id: expect.any(String),
            request,
          }),
        );
      });

      it(`should throw a ${FailedUploadError.name} if the Publication Metadata upload fails`, async () => {
        const apolloClient = createMockApolloClientWithMultipleResponses([]);
        const { gateway } = setupTestScenario({ apolloClient });

        await expect(() => gateway.createDelegatedTransaction(request)).rejects.toThrow(
          FailedUploadError,
        );
      });
    });
  });
});
