export interface WorkflowActions {
  /* @oods-domain-action handleCancel sha256:e8eee895cb879c6be09dbe320b8df87643e06ebac9d7568a8be807ac89139d99 */
  /* @oods-domain-source sha256:a340cc3e4279d3b55f8af9f92525c31976c6714edbafc6a842629011926a9688 */
  handleCancel: () => void;
  /* @oods-domain-action handleEdit sha256:182384d13b6b98a724f3da849699c7366e6563e36e5d43b4a0e193875662bc50 */
  /* @oods-domain-source sha256:e0774f642e1a26ebce8a8d9dae8da4a509838d11a3f255381068363bb2920c5a */
  handleEdit: () => void;
  /* @oods-domain-action handleFilter sha256:3caa4ca45751d5f98ecb9ca5b3bad67dae3648851ba5c81266abe239c327333e */
  /* @oods-domain-source sha256:dcd80e5df82a87effadc835ba3ee01b87b8f94956dd248f3916e4caea4eeaee2 */
  handleFilter: (criteria: Record<string, unknown>) => void;
  /* @oods-domain-action handlePageChange sha256:96a80b8c3ce40c07c8848f6f1c89113ff702b20ed4b76f78632453ea8e2c87d8 */
  /* @oods-domain-source sha256:0a8c55c98fd586a66355cacc9e6a93637464d275e70b994fc88514b12079369f */
  handlePageChange: (page: number) => void;
  /* @oods-domain-action handleRowClick sha256:ceae6f55efc7d37856f8f7289091cfbaf7a9e975d11de5d12d3c0cad4486b910 */
  /* @oods-domain-source sha256:40f1128b9a619913b31806b44fb2798a64ee2fe80586edfbd8c637eb690790e1 */
  handleRowClick: (rowId: string) => void;
  /* @oods-domain-action handleSort sha256:7e0b149250c324d6472b9703e8d2a0e89c0ea2a39f11ac7bdfab83da38f9607b */
  /* @oods-domain-source sha256:1d35bd28d115ccb4e75fd245375fc8db7b06af97b029755330560fdbc0a86211 */
  handleSort: (column: string) => void;
  /* @oods-domain-action handleSubmit sha256:2f6aa5a9b7d11a3da9990fa83c008344c4ccae92969fb06db5ed068195a26871 */
  /* @oods-domain-source sha256:2774690c84b88d282fa52995d82608d30054d91e7730e9b770103035c2565545 */
  handleSubmit: () => void;
  /* @oods-domain-action handleViewTimeline sha256:77fdf70710dad3e639537244fdc3c3a64e330b99b0cb1427d79f38c14ebf78fe */
  /* @oods-domain-source sha256:ff23e1f2f34ea61a383aabf23a73f205422002045d7cd5f98aec63fc98ee9b6c */
  handleViewTimeline: () => void;
}
